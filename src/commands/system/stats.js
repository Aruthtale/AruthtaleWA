import { db } from '../../services/firebaseService.js';
import { log } from '../../utils/logger.js';

/**
 * Command: !stats
 * Menampilkan ringkasan metrik AI dan link ke Dashboard Web
 */
export default async (sock, m) => {
    const remoteJid = m.key.remoteJid;

    try {
        await sock.sendMessage(remoteJid, { text: '📊 *Mengambil data analitik...*' }, { quoted: m });

        // Dapatkan data 24 jam terakhir dari Firestore
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const snapshot = await db.collection('ai_metrics')
            .where('created_at', '>=', yesterday)
            .get();

        if (snapshot.empty) {
            return await sock.sendMessage(remoteJid, { text: `📊 *AI STATS (24 JAM TERAKHIR)*\n\n_Belum ada data stats di Firestore._\n\nBuka dashboard lengkap di: http://localhost:8899` }, { quoted: m });
        }

        const data = snapshot.docs.map(doc => doc.data());
        const totalReq = data.length;
        let successCount = 0;
        const providers = {};

        data.forEach(row => {
            if (row.status === 'success') successCount++;
            if (row.provider) {
                providers[row.provider] = (providers[row.provider] || 0) + 1;
            }
        });

        const successRate = totalReq > 0 ? Math.round((successCount / totalReq) * 100) : 0;
        
        // Format teks untuk provider top
        const sortedProviders = Object.entries(providers).sort((a, b) => b[1] - a[1]);
        let provText = '';
        if (sortedProviders.length > 0) {
            provText = `\n*Distribusi API:*\n` + sortedProviders.map(([p, count]) => `• ${p.toUpperCase()}: ${count}`).join('\n');
        }

        const msg = `📊 *AI STATS (24 JAM TERAKHIR)*

*Total Request:* ${totalReq}
*Keberhasilan:* ${successRate}%${provText}

📈 *Lihat Grafik Interaktif:*
http://localhost:8899`;

        await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
    } catch (err) {
        log.error('Stats Command Error:', err.message);
        await sock.sendMessage(remoteJid, { text: `❌ *Gagal mengambil stats:* ${err.message}` }, { quoted: m });
    }
};
