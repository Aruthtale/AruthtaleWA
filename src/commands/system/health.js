import { healthService } from '../../system/health.js';
import { log } from '../../utils/logger.js';
import { aiProvider } from '../../ai/provider.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    
    try {
        log.system('Generating health report...');
        const stats = healthService.getStatus(sock);

        // Get AI Insight
        let aiInsight = '';
        try {
            const aiPrompt = `DATA TEKNIS SISTEM:\n` +
                             `- Koneksi WA: ${stats.connection}\n` +
                             `- Uptime Bot: ${stats.uptime}\n` +
                             `- Memory Heap: ${stats.memory}\n` +
                             `- Load Avg (1m): ${stats.system.load}\n` +
                             `- RAM Tersedia: ${stats.system.freeMem}\n\n` +
                             `TUGAS: Analisis data di atas secara teknis.\n` +
                             `1. Jika Load > 2.0 atau RAM sangat tipis, berikan peringatan keras dan saran tindakan (misal: pkill proses berat).\n` +
                             `2. Jika suhu/load normal, berikan saran optimasi ringan.\n` +
                             `3. JANGAN basa-basi "bot offline". Fokus pada performa hardware.\n` +
                             `4. Maksimal 2 kalimat singkat dan padat.`;
            
            aiInsight = await aiProvider.chat(aiPrompt, { 
                systemInstruction: "Kamu adalah Senior System Administrator Linux yang proaktif dan teknis. Berikan analisis langsung ke intinya." 
            });
        } catch (e) {
            aiInsight = "Gagal menganalisis data secara mendalam.";
        }

        const report = `🏥 *AI-WA-BOT HEALTH REPORT*\n\n` +
                       `🟢 *Status:* ${stats.connection}\n` +
                       `⏱️ *Uptime:* ${stats.uptime}\n` +
                       `🧠 *Heap Usage:* ${stats.memory}\n\n` +
                       `💻 *SYSTEM INFO:*\n` +
                       `• *Load (1m):* ${stats.system.load}\n` +
                       `• *Free RAM:* ${stats.system.freeMem}\n` +
                       `• *Platform:* ${stats.system.platform}\n` +
                       `• *CPU:* ${stats.system.cpu}\n\n` +
                       `🤖 *AI INSIGHT:*\n` +
                       `_"${aiInsight.trim()}"_`;

        await sock.sendMessage(remoteJid, { text: report }, { quoted: m });
    } catch (error) {
        log.error('Health Command Error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil laporan kesehatan: ${error.message}` });
    }
};
