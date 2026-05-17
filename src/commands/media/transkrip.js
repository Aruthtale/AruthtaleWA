import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { askGemini } from '../../ai/gemini.js';
import { log } from '../../utils/logger.js';

export const help = `🎙️ *Bantuan !transkrip*

Mengubah rekaman suara (Voice Note), Audio, atau Video menjadi teks.

*Format:* Balas pesan suara/audio/video dengan perintah \`!transkrip\`

*Fitur:*
- Mendukung Bahasa Indonesia & Inggris.
- Otomatis meringkas poin-poin penting.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const message = m.message?.audioMessage || 
                    m.message?.videoMessage || 
                    quoted?.audioMessage ||
                    quoted?.videoMessage;

    if (!message) {
        return await sock.sendMessage(remoteJid, { text: '❌ Balas pesan suara, audio, atau video yang ingin ditranskrip dengan perintah *!transkrip*' }, { quoted: m });
    }

    try {
        log.wa(`Processing transcription for: ${remoteJid}`);
        const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mendengarkan & mentranskrip...*' }, { quoted: m });

        const buffer = await downloadMediaMessage(
            quoted ? { message: quoted } : m,
            'buffer',
            {},
            { logger: log }
        );

        if (!buffer) throw new Error('Gagal mendownload media.');

        const mimeType = message.mimetype || 'audio/ogg; codecs=opus';
        
        const prompt = "Transkripsikan audio ini dengan sangat akurat. " +
                       "Gunakan Bahasa Indonesia jika audionya berbahasa Indonesia. " +
                       "Setelah transkrip, berikan ringkasan singkat dalam bentuk poin-poin jika kontennya panjang.";

        const result = await askGemini(prompt, {
            audio: {
                data: buffer.toString('base64'),
                mimeType: mimeType.split(';')[0]
            },
            model: 'gemini-2.0-flash' // Best for fast multimodal tasks
        });

        await sock.sendMessage(remoteJid, { 
            text: `📝 *Hasil Transkrip:* \n\n${result.text}` 
        }, { quoted: m });

        await sock.sendMessage(remoteJid, { text: '✅ Transkrip selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('Transcription error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mentranskrip: ${error.message}` }, { quoted: m });
    }
};
