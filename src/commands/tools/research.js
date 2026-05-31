import { webResearchService } from '../../services/webResearchService.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

/**
 * Command: !research / !deepresearch
 * Mencari informasi terbaru di internet dan membuat laporan menggunakan AI
 */
export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const query = args.join(' ');

    if (!query) {
        return sock.sendMessage(remoteJid, { text: '❌ Masukkan topik yang ingin dicari.\nContoh: `!research harga bitcoin hari ini`' }, { quoted: m });
    }

    try {
        await react(sock, m, '🔎');
        
        // Deteksi apakah user memanggil !deepresearch
        const cmdName = m.message?.conversation?.split(' ')[0] || m.message?.extendedTextMessage?.text?.split(' ')[0] || '';
        const isDeepResearch = cmdName.toLowerCase() === '!deepresearch';
        
        const infoText = isDeepResearch 
            ? `🔎 *Sedang melakukan Deep Research untuk:* "${query}"\n_Membaca hingga 5 halaman web. Ini mungkin memakan waktu hingga 30 detik..._`
            : `🔎 *Sedang mencari:* "${query}"\n_Memproses hasil..._`;
            
        await sock.sendMessage(remoteJid, { text: infoText }, { quoted: m });

        const result = await webResearchService.generateReport(query, isDeepResearch);
        
        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { text: result.text }, { quoted: m });
    } catch (error) {
        log.error('Research Command Error:', error.message);
        await react(sock, m, '❌');
        await sock.sendMessage(remoteJid, { text: `❌ *Gagal melakukan riset:* ${error.message}` }, { quoted: m });
    }
};
