import { askGemini } from '../../ai/gemini.js';
import { askOpenRouter } from '../../ai/openrouter.js';
import { memoryService } from '../../services/memory.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const startAll = Date.now();
    
    try {
        const { key } = await sock.sendMessage(remoteJid, { text: '🏓 *Pinging services...*' }, { quoted: m });
        
        // 1. Supabase Latency
        let latDb;
        try {
            const startDb = Date.now();
            await memoryService.ping();
            latDb = `${Date.now() - startDb}ms`;
        } catch (e) {
            latDb = `❌ Error`;
        }

        // 2. Gemini Native Latency (Direct Google AI Studio)
        let latGemini;
        try {
            const startGemini = Date.now();
            await askGemini('hi', { systemInstruction: 'respond with ok' });
            latGemini = `${Date.now() - startGemini}ms`;
        } catch (e) {
            latGemini = `❌ ${e.response?.status || 'Error'}`;
        }

        // 3. OpenRouter Latency (using MiniMax M2.5 Free)
        let latOR;
        try {
            const startOR = Date.now();
            const orPromise = askOpenRouter('hi', 'minimax/minimax-m2.5:free');
            // Give OpenRouter max 10s for the ping test
            const result = await Promise.race([
                orPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
            ]);
            latOR = `${Date.now() - startOR}ms`;
        } catch (e) {
            latOR = `❌ ${e.message === 'Timeout' ? 'Timeout' : (e.response?.status || 'Error')}`;
        }

        const totalLat = Date.now() - startAll;

        const report = `📊 *SYSTEM LATENCY REPORT* 📊\n\n` +
                       `☁️ *Gemini (Native):* \`${latGemini}\`\n` +
                       `🌐 *OpenRouter (MiniMax):* \`${latOR}\`\n` +
                       `🗄️ *Supabase:* \`${latDb}\`\n` +
                       `⚡ *Total RTT:* \`${totalLat}ms\`\n\n` +
                       `*Status:* ${totalLat < 5000 ? '🟢 Excellent' : totalLat < 10000 ? '🟡 Normal' : '🔴 Laggy'}`;

        await sock.sendMessage(remoteJid, { text: report, edit: key });
        
    } catch (error) {
        log.error('Ping command failed:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ *Ping Failed:* ${error.message}` });
    }
};
