import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { askGemini } from '../../ai/gemini.js';
import { log } from '../../utils/logger.js';
import { downloaderService } from '../../workers/downloader.js';
import fs from 'fs';

export const help = `🎙️ *Bantuan !transkrip*

Mengubah rekaman suara (Voice Note), Audio, Video, atau Link (YouTube) menjadi teks.

*Format:* 
1. Balas pesan suara/audio/video dengan perintah \`!transkrip\`
2. Gunakan perintah \`!transkrip <link_youtube>\`

*Fitur:*
- Mendukung Bahasa Indonesia & Inggris.
- Otomatis meringkas poin-poin penting.
- Mendukung link YouTube, TikTok, dll.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = (m.key.participant || m.key.remoteJid).split('@')[0];
    
    // 1. Check for URL in args or quoted text
    const text = args.join(' ') || '';
    const quotedText = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || 
                       m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';
    
    const urlRegex = /https?:\/\/[^\s]+/i;
    const url = text.match(urlRegex)?.[0] || quotedText.match(urlRegex)?.[0];

    // 2. Check for quoted media
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMessage = m.message?.audioMessage || 
                         m.message?.videoMessage || 
                         quoted?.audioMessage ||
                         quoted?.videoMessage;

    if (!url && !mediaMessage) {
        return await sock.sendMessage(remoteJid, { text: '❌ Balas pesan suara, audio, video, atau berikan link (YouTube/TikTok) yang ingin ditranskrip.' }, { quoted: m });
    }

    let tempDir;
    try {
        log.wa(`Processing transcription for: ${remoteJid}`);
        const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang memproses...*' }, { quoted: m });

        let buffer;
        let mimeType;
        let transcriptText;

        const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'));

        if (isYouTube) {
            try {
                await sock.sendMessage(remoteJid, { text: '📥 *Mengambil transcript teks dari YouTube...*', edit: statusMsg.key });
                transcriptText = await downloaderService.getYouTubeTranscript(url);
                log.info('Successfully extracted YouTube transcript text.');
            } catch (e) {
                log.warn('YouTube text transcript failed, falling back to audio download:', e.message);
            }
        }

        if (!transcriptText && url) {
            log.info(`Downloading audio from URL: ${url}`);
            await sock.sendMessage(remoteJid, { text: '📥 *Mengunduh audio dari link...*', edit: statusMsg.key });
            
            const result = await downloaderService.downloadAudio(url, senderNumber);
            const file = result.files[0];
            if (!file) throw new Error('Gagal mengekstrak audio dari link tersebut.');
            
            tempDir = result.tempDir;
            buffer = fs.readFileSync(file.filePath);
            mimeType = 'audio/mp3';
        } else if (!transcriptText) {
            buffer = await downloadMediaMessage(
                quoted ? { message: quoted } : m,
                'buffer',
                {},
                { logger: log }
            );
            mimeType = mediaMessage.mimetype || 'audio/ogg; codecs=opus';
        }

        if (!transcriptText && !buffer) throw new Error('Gagal memproses media.');

        await sock.sendMessage(remoteJid, { text: '✍️ *Sedang meringkas & memformat...*', edit: statusMsg.key });

        let result;
        if (transcriptText) {
            const prompt = "Berikut adalah transcript dari sebuah video. " +
                           "Tolong buatkan ringkasan yang sangat informatif dalam Bahasa Indonesia. " +
                           "Berikan poin-poin penting dan detail utama yang dibahas. \n\n" +
                           "Transcript: " + transcriptText;
            
            result = await askGemini(prompt, { model: 'gemini-3.5-flash' });
        } else {
            const prompt = "Transkripsikan audio ini dengan sangat akurat. " +
                           "Gunakan Bahasa Indonesia jika audionya berbahasa Indonesia. " +
                           "Setelah transkrip, berikan ringkasan singkat dalam bentuk poin-poin jika kontennya panjang.";

            result = await askGemini(prompt, {
                audio: {
                    data: buffer.toString('base64'),
                    mimeType: mimeType.split(';')[0]
                },
                model: 'gemini-3.5-flash'
            });
        }

        await sock.sendMessage(remoteJid, { 
            text: `📝 *Hasil Transkrip & Ringkasan:* \n\n${result.text}` 
        }, { quoted: m });

        await sock.sendMessage(remoteJid, { text: '✅ Selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('Transcription error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mentranskrip: ${error.message}` }, { quoted: m });
    } finally {
        if (tempDir) {
            downloaderService.cleanup(tempDir);
        }
    }
};
