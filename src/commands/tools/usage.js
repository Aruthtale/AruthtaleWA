import { usageService } from '../../services/usageService.js';

export const help = `📊 *Bantuan !usage*

Tampilkan statistik penggunaan bot Anda hari ini.

*Format:* \`!usage\`
*Info yang ditampilkan:*
- Total Token AI yang digunakan
- Total Data Download (Media)
- Total Gambar yang dihasilkan
- Total Perintah yang dijalankan`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];

    try {
        const stats = await usageService.getDailyStats(senderNumber);

        if (!stats) {
            return await sock.sendMessage(remoteJid, { text: '❌ Gagal mengambil data penggunaan.' }, { quoted: m });
        }

        const text = `📊 *Statistik Penggunaan Aruthtale*\n` +
                     `_(Hari Ini - ${new Date().toLocaleDateString('id-ID')})_\n\n` +
                     `🤖 *AI Tokens:* ${stats.aiTokens.toLocaleString()}\n` +
                     `📥 *Media Download:* ${stats.downloadMb.toFixed(2)} MB\n` +
                     `🎨 *Image Generated:* ${stats.imageGen}\n` +
                     `⚡ *Total Perintah:* ${stats.commands}\n\n` +
                     `💡 _Gunakan bot dengan bijak untuk menjaga performa server._`;

        await sock.sendMessage(remoteJid, { text }, { quoted: m });

    } catch (error) {
        await sock.sendMessage(remoteJid, { text: `❌ Error: ${error.message}` });
    }
};
