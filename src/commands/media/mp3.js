import { downloaderService } from '../../workers/downloader.js';
import { log } from '../../utils/logger.js';
import { sanitizeUrl } from '../../utils/sanitizer.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];

    if (!url) {
        return await sock.sendMessage(remoteJid, { text: `❌ Mana link YouTube-nya, Bos?\nFormat: *!mp3 <url_video>*` }, { quoted: m });
    }

    let statusMsg;
    let tempDir;
    try {
        const sanitizedUrl = sanitizeUrl(url);
        log.wa(`MP3 extraction request for: ${sanitizedUrl}`);
        statusMsg = await sock.sendMessage(remoteJid, { text: `⏳ *Mencari audio...*` }, { quoted: m });

        const senderNumber = remoteJid.split('@')[0];
        const result = await downloaderService.downloadAudio(sanitizedUrl, senderNumber);
        const files = result.files;
        tempDir = result.tempDir;

        if (files.length === 0) {
            return await sock.sendMessage(remoteJid, { text: `❌ Tidak ditemukan audio yang bisa diekstrak.`, edit: statusMsg.key });
        }

        await sock.sendMessage(remoteJid, { text: `🎵 *Mengekstrak audio (${files.length} item)...*`, edit: statusMsg.key });

        for (const file of files) {
            await sock.sendMessage(remoteJid, { 
                audio: { url: file.filePath },
                mimetype: 'audio/mp4',
                fileName: `${file.title}.mp3`
            }, { quoted: m });
        }

        await sock.sendMessage(remoteJid, { text: `✅ *Selesai!* Audio telah terkirim.`, edit: statusMsg.key });

    } catch (error) {
        log.error('MP3 command error:', error.message);
        const errorMsg = error.message.startsWith('❌') ? error.message : `❌ Gagal: ${error.message}`;
        if (statusMsg) {
            await sock.sendMessage(remoteJid, { text: errorMsg, edit: statusMsg.key });
        } else {
            await sock.sendMessage(remoteJid, { text: errorMsg });
        }
    } finally {
        if (tempDir) downloaderService.cleanup(tempDir);
    }
};
