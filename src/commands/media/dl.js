import { downloaderService } from '../../workers/downloader.js';
import { usageService } from '../../services/usageService.js';
import { log } from '../../utils/logger.js';
import { sanitizeUrl } from '../../utils/sanitizer.js';
import fs from 'fs';

export const help = `📥 *Bantuan !dl*

Download video/media dari berbagai platform (TikTok, Instagram, YouTube, Twitter, Pinterest).

*Format:* \`!dl [url]\`
*Contoh:* \`!dl https://www.tiktok.com/@user/video/...\`

*Fitur:*
- Auto-detect platform
- Kirim sebagai dokumen jika file > 64MB
- Mendukung thumbnail (jika tersedia)`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];
    const url = args[0];

    if (!url) {
        return await sock.sendMessage(remoteJid, { text: `❌ Mana link-nya, Bos?\nFormat: *!dl <url_video>*` }, { quoted: m });
    }

    let statusMsg;
    let tempDir;
    try {
        const sanitizedUrl = sanitizeUrl(url);
        log.wa(`Manual download request for: ${sanitizedUrl}`);
        statusMsg = await sock.sendMessage(remoteJid, { text: `⏳ *Mencari konten...*` }, { quoted: m });

        const result = await downloaderService.download(sanitizedUrl, senderNumber);
        const files = result.files;
        tempDir = result.tempDir;

        if (files.length === 0) {
            return await sock.sendMessage(remoteJid, { text: `❌ Tidak ditemukan video yang bisa didownload.`, edit: statusMsg.key });
        }

        for (const file of files) {
            const stats = fs.statSync(file.filePath);
            const fileSizeInMB = stats.size / (1024 * 1024);
            const isLarge = fileSizeInMB > 64;

            const mediaOptions = { 
                caption: `✅ *Item:* ${file.title}\n⏱️ *Duration:* ${file.duration}\n⚖️ *Size:* ${fileSizeInMB.toFixed(1)}MB`,
            };

            if (isLarge) {
                mediaOptions.document = { url: file.filePath };
                mediaOptions.mimetype = 'video/mp4';
                mediaOptions.fileName = `${file.title}.mp4`;
            } else {
                mediaOptions.video = { url: file.filePath };
                mediaOptions.mimetype = 'video/mp4';
                if (file.thumbnailPath && fs.existsSync(file.thumbnailPath)) {
                    mediaOptions.jpegThumbnail = fs.readFileSync(file.thumbnailPath).toString('base64');
                }
            }

            await sock.sendMessage(remoteJid, mediaOptions);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await sock.sendMessage(remoteJid, { text: `✅ *Selesai!* Semua konten telah terkirim.`, edit: statusMsg.key });

    } catch (error) {
        log.error('Manual download error:', error.message);
        const errorMsg = error.message.startsWith('❌') ? error.message : `❌ Gagal mendownload: ${error.message}`;
        if (statusMsg) {
            await sock.sendMessage(remoteJid, { text: errorMsg, edit: statusMsg.key });
        } else {
            await sock.sendMessage(remoteJid, { text: errorMsg });
        }
    } finally {
        if (tempDir) downloaderService.cleanup(tempDir);
    }
};
