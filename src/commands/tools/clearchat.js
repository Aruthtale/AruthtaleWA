import { createClient } from '@supabase/supabase-js';
import { settings } from '../../config/settings.js';
import { aiCache } from '../../services/aiCache.js';
import { log } from '../../utils/logger.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

export const help = `🧹 *Bantuan !clearchat*

Menghapus riwayat percakapan Anda dari memori bot.

*Format:* \`!clearchat\`
*Shortcut:* \`!clear\``;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;

    try {
        log.wa(`Clearing history for: ${remoteJid}`);
        
        // 1. Clear Supabase
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('user_id', remoteJid);

        if (error) throw error;

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
