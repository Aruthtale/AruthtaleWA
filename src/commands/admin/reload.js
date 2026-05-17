import { settings } from '../../config/settings.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];

    if (senderNumber !== settings.ownerNumber) {
        return await sock.sendMessage(remoteJid, { text: '❌ Hanya Owner yang bisa me-reload modul.' });
    }

    try {
        // Increment version in global scope (will be used by commandRouter)
        if (!global.commandVersion) global.commandVersion = 1;
        global.commandVersion++;

        log.system(`Command modules reloaded to version ${global.commandVersion}`);
        
        await sock.sendMessage(remoteJid, { 
            text: `✅ *Reload Berhasil!*\n\nModul perintah sekarang menggunakan versi cache baru (v${global.commandVersion}). Anda dapat mencoba perubahan kode tanpa restart bot.` 
        }, { quoted: m });

    } catch (error) {
        log.error('Reload failed:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ *Reload Gagal:* ${error.message}` });
    }
};
