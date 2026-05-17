import { searchService } from '../../services/searchService.js';
import { aiProvider } from '../../ai/provider.js';
import { react } from '../../utils/react.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const query = args.join(' ');

    if (!query) {
        return await sock.sendMessage(remoteJid, { 
            text: '🔍 Sertakan apa yang ingin dicari.\nContoh: `!search skor bola semalam` atau `!search harga bitcoin hari ini`' 
        }, { quoted: m });
    }

    await react(sock, m, '⏳');
    await sock.sendMessage(remoteJid, { text: `🌐 *Sedang mencari di internet: "${query}"...*` }, { quoted: m });

    try {
        // 1. Try manual search first (fast & uses no tokens for grounding)
        let results = await searchService.search(query);
        let resultText = '';

        if (results.length > 0) {
            // Format context for AI
            const searchContext = results.map((r, i) => `[${i+1}] ${r.title}\nSource: ${r.link}\nInfo: ${r.snippet}`).join('\n\n');
            
            const oraclePrompt = `You are the Aruthtale Oracle. I have searched the web for: "${query}".
            Based on the search results below, provide a concise, accurate, and professional answer in Indonesian.
            Always cite your sources using [number].
            
            Search Results:
            ${searchContext}`;

            const aiResult = await aiProvider.chat(oraclePrompt, {
                systemInstruction: "You are a professional research assistant. Your answers must be based on real-time data provided in the search context. Be direct, clear, and helpful.",
                task: 'GENERAL'
            });
            resultText = aiResult.text;
        } else {
            // 2. Fallback to Gemini Native Google Search Grounding
            const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            log.info(`[Search] Manual search failed for "${query}". Falling back to Gemini Grounding...`);
            const aiResult = await aiProvider.chatWithTools(`TODAY: ${currentDate}. SEARCH THE INTERNET FOR LATEST DATA: "${query}". Respond in professional Indonesian. Cite your sources clearly using [Title](Link).`, {
                systemInstruction: `You are the Aruthtale Oracle. Today is ${currentDate}. You MUST use your Google Search tool to provide real-time information. If the search tool fails or returns no results, state clearly that you are using your training data but prioritize looking for 2025/2026 information.`,
            });
            resultText = aiResult.text;
        }

        await react(sock, m, '✅');
        
        return await sock.sendMessage(remoteJid, { 
            text: `🌐 *ORACLE SEARCH RESULTS*\n\n${resultText}\n\n_Data diambil secara real-time dari internet._` 
        }, { quoted: m });

    } catch (error) {
        await react(sock, m, '❌');
        return await sock.sendMessage(remoteJid, { text: `⚠️ Gagal melakukan pencarian: ${error.message}` }, { quoted: m });
    }
};
