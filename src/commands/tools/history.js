import { db } from '../../services/firebaseService.js';
import { settings } from '../../config/settings.js';
import { log } from '../../utils/logger.js';

export const help = `📜 *Bantuan !history*

Menampilkan riwayat percakapan terakhir Anda dengan bot.

*Format:* \`!history\` atau \`!history [jumlah]\`
*Contoh:* \`!history 5\` - tampilkan 5 pesan terakhir

*Akses:* Public.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const limit = Math.min(parseInt(args[0]) || 5, 10);

    try {
        const snapshot = await db.collection('memories')
            .where('user_id', '==', remoteJid)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const data = snapshot.docs.map(doc => doc.data());

        if (data.length === 0) {
            return await sock.sendMessage(remoteJid, {
                text: '📭 Belum ada riwayat percakapan.'
            }, { quoted: m });
        }

        const lines = data.reverse().map((row, i) => {
            const role = row.role === 'user' ? '👤 *Kamu*' : '🤖 *Aruthtale*';
            const content = row.content.length > 100
                ? row.content.slice(0, 100) + '...'
                : row.content;
            return `${role}\n${content}`;
        });

        const text = `📜 *Riwayat ${limit} Pesan Terakhir:*\n\n` + lines.join('\n\n─────\n\n');
        await sock.sendMessage(remoteJid, { text }, { quoted: m });

    } catch (error) {
        log.error('History command error:', error.message);
        await sock.sendMessage(remoteJid, {
            text: `❌ Gagal mengambil riwayat: ${error.message}`
        }, { quoted: m });
    }
};
