import { downloaderService } from '../../workers/downloader.js';
import { createAnimatedSticker } from '../../utils/sticker.js';
import { log } from '../../utils/logger.js';
import { sanitizeUrl } from '../../utils/sanitizer.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const help = `🎬 *Bantuan !vsticker*

Ubah video atau link menjadi Sticker Bergerak (Animated Sticker).

*Cara Penggunaan:*
1. Kirim link video: \`!vsticker [url]\`
2. Reply video: Balas video apapun dengan caption \`!vsticker\`

*Authorized:* Owner & Authorized Users Only.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    let videoPath;
    let tempDir;

    try {
        // 1. Get Video Source
        const currentMsg = m.message?.videoMessage || m.message?.viewOnceMessage?.message?.videoMessage;
        
        if (url) {
            // From Link
            const sanitizedUrl = sanitizeUrl(url);
            await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mendownload video dari link...*' }, { quoted: m });
            const result = await downloaderService.download(sanitizedUrl);
            if (result.files.length === 0) throw new Error('Video tidak ditemukan di link tersebut.');
            videoPath = result.files[0].filePath;
            tempDir = result.tempDir;
        } else if (currentMsg) {
            // From Current Message (Caption)
            await sock.sendMessage(remoteJid, { text: '⏳ *Sedang memproses video...*' }, { quoted: m });
            const stream = await downloadContentFromMessage(currentMsg, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            videoPath = path.join(os.tmpdir(), `temp_vid_${Date.now()}.mp4`);
            fs.writeFileSync(videoPath, buffer);
            
            if (buffer.length === 0) throw new Error('Gagal mengambil data video (Buffer kosong).');
        } else if (quoted) {
            // From Quoted Message
            const videoMsg = quoted.videoMessage || 
                           quoted.viewOnceMessage?.message?.videoMessage || 
                           quoted.documentWithCaptionMessage?.message?.videoMessage ||
                           (quoted.documentMessage?.mimetype?.includes('video') ? quoted.documentMessage : null);

            if (!videoMsg) throw new Error('Balas video atau sertakan link video!');

            await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mengambil video dari pesan yang dibalas...*' }, { quoted: m });
            const stream = await downloadContentFromMessage(videoMsg, videoMsg.mimetype?.includes('video') ? 'video' : 'document');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            videoPath = path.join(os.tmpdir(), `temp_vid_${Date.now()}.mp4`);
            fs.writeFileSync(videoPath, buffer);
            
            if (buffer.length === 0) throw new Error('Gagal mengambil data video dari pesan (Buffer kosong).');
        } else {
            return await sock.sendMessage(remoteJid, { text: '❌ Balas video atau sertakan link video!' }, { quoted: m });
        }

        // 2. Convert to Animated WebP
        const stickerPath = await createAnimatedSticker(videoPath);

        // 3. Send Sticker
        await sock.sendMessage(remoteJid, { 
            sticker: fs.readFileSync(stickerPath) 
        }, { quoted: m });

        // 4. Cleanup
        if (fs.existsSync(stickerPath)) fs.unlinkSync(stickerPath);
        if (!tempDir && fs.existsSync(videoPath)) fs.unlinkSync(videoPath); // Only delete if it's our temp file

    } catch (error) {
        log.error('vsticker command error:', error);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membuat sticker bergerak: ${error.message || 'Terjadi kesalahan internal'}` });
    } finally {
        if (tempDir) downloaderService.cleanup(tempDir);
    }
};
