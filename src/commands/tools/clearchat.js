import { db } from '../../services/firebaseService.js';
import { settings } from '../../config/settings.js';
import { aiCache } from '../../services/aiCache.js';
import { log } from '../../utils/logger.js';

export const help = `🧹 *Bantuan !clearchat*

Menghapus riwayat percakapan Anda dari memori bot.

*Format:* \`!clearchat\`
*Shortcut:* \`!clear\``;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;

    try {
        log.wa(`Clearing history for: ${remoteJid}`);
        
        // 1. Clear Firestore
        const snapshot = await db.collection('memories')
            .where('user_id', '==', remoteJid)
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // 2. Clear AI Cache
        aiCache.clear(remoteJid);

        await sock.sendMessage(remoteJid, { 
            text: '✅ *Berhasil!* Riwayat percakapan Anda telah dihapus dari memori bot.' 
        }, { quoted: m });

    } catch (error) {
        log.error('Clear chat error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal menghapus riwayat: ${error.message}` }, { quoted: m });
    }
};
