import { aiProvider } from '../ai/provider.js';
import { memoryService } from './memory.js';
import { aiCache } from './aiCache.js';
import { securityFilter } from '../utils/security.js';
import { log } from '../utils/logger.js';
import { usageService } from './usageService.js';
import { settings } from '../config/settings.js';
import fs from 'fs';
import path from 'path';

// Read context files
const informationContext = fs.readFileSync(path.resolve(process.cwd(), 'docs/information.md'), 'utf8');
const cctvContext = fs.readFileSync(path.resolve(process.cwd(), 'docs/lokasicctv.md'), 'utf8');

export const aiHandler = {
    processChat: async (sock, m, senderNumber, messageText, isOwner, isAuthorized, history) => {
        const remoteJid = m.key.remoteJid;
        
        // Timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI Request Timeout (90s)')), 90000)
        );

        // Security check
        if (securityFilter.isPromptInjection(messageText)) {
            log.warn(`[SECURITY] Potential prompt injection from ${remoteJid}`);
            return await sock.sendMessage(remoteJid, { text: "⚠️ *Peringatan Keamanan:* Pesan Anda mengandung pola yang mencurigakan dan telah diblokir." }, { quoted: m });
        }

        const aiTask = (async () => {
            // 1. Clever Rules & Immediate Responses
            const lowerText = messageText.toLowerCase();
            const isCommand = messageText.startsWith(settings.prefix);
            
            // Image request check
            if (!isCommand && (lowerText.includes('gambar') || lowerText.includes('image') || lowerText.includes('foto'))) {
                const imageKeywords = ['kirim', 'buat', 'generate', 'cari', 'show', 'send', 'make'];
                if (imageKeywords.some(kw => lowerText.includes(kw))) {
                    return { text: "Maaf, fitur pengiriman gambar belum tersedia untuk saat ini, namun akan segera hadir." };
                }
            }

            // Identity check
            if (!isCommand && (lowerText.includes('siapa kamu') || lowerText.includes('who are you'))) {
                return { text: "Saya adalah asisten AI yang dikembangkan oleh Aruth." };
            }

            // Research check
            const researchKeywords = ['hari ini', 'terbaru', 'berita', 'harga', 'cuaca', 'sekarang', 'update', 'populer', 'akhir ini', 'viral', 'saat ini'];
            const needsResearch = !isCommand && researchKeywords.some(kw => lowerText.includes(kw)) && messageText.split(' ').length > 2;

            if (needsResearch) {
                log.info(`[Hybrid] Auto-Research triggered: "${messageText}"`);
                const { webResearchService } = await import('./webResearchService.js');
                const researchResult = await webResearchService.generateReport(messageText, false);
                await usageService.logUsage(senderNumber, 'AI_TOKENS', researchResult.usage?.totalTokenCount || 0);
                await memoryService.save(remoteJid, 'user', messageText);
                await memoryService.save(remoteJid, 'assistant', researchResult.text);
                return { text: researchResult.text };
            }

            // 2. Prepare System Instruction
            const systemInstruction = `${settings.systemPrompt}

[DOKUMENTASI BOT (information.md)]
${informationContext}

[DATA LOKASI CCTV (lokasicctv.md)]
${cctvContext}

[ATURAN TAMBAHAN]
1. Identitas: Jika ditanya siapa kamu, jawab kamu adalah asisten AI yang dikembangkan oleh Aruth.
2. Gambar: Jika user meminta gambar/foto, jawab bahwa fitur tersebut belum tersedia namun akan segera hadir.
3. Bahasa: Balaslah menggunakan bahasa yang sama dengan user (Bahasa Indonesia, Inggris, atau bahasa gaul/casual).
4. Pengetahuan: Gunakan dokumentasi bot dan data CCTV di atas untuk menjawab pertanyaan yang relevan.
`;

            // 3. Routing & Execution
            const { classifyIntent } = await import('../ai/classifier.js');
            const task = classifyIntent(messageText);
            
            // ⌨️ Send typing indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            const result = await aiProvider.chat(messageText, {
                task,
                history,
                isOwner,
                systemInstruction
            });

            await usageService.logUsage(senderNumber, 'AI_TOKENS', result.usage?.totalTokenCount || 0);
            aiCache.set(messageText, remoteJid, result);
            await memoryService.save(remoteJid, 'user', messageText);
            await memoryService.save(remoteJid, 'assistant', result.text);
            
            return { text: result.text };
        })();

        try {
            const res = await Promise.race([aiTask, timeoutPromise]);
            if (res && res.text) {
                // Clean response from AI-specific markers if any
                const cleanedText = res.text
                    .replace(/```json\s*{[\s\S]*?}\s*```/g, '')
                    .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
                    .trim();
                
                await sock.sendMessage(remoteJid, { text: cleanedText }, { quoted: m });
            }
        } catch (error) {
            log.error('AI Processing Error:', error.message);
            await sock.sendMessage(remoteJid, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
        }
    }
};
