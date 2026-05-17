import { downloadWAMedia } from '../../utils/waUtils.js';
import { aiProvider } from '../../ai/provider.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;

    // 1. Dapatkan gambar (dari pesan sekarang atau pesan yang dibalas)
    const message = m.message?.imageMessage ? m.message : m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = message?.imageMessage;

    if (!isImage) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Silakan kirim gambar dengan caption `!ocr` atau balas sebuah gambar dengan `!ocr`.' 
        }, { quoted: m });
    }

    await react(sock, m, '⏳');
    await sock.sendMessage(remoteJid, { text: '👁️ *Sedang membaca teks pada gambar...*' }, { quoted: m });

    try {
        // 2. Download Media
        const buffer = await downloadWAMedia(message);
        const base64Image = buffer.toString('base64');

        // 3. Minta AI melakukan OCR secara cerdas
        const ocrPrompt = `Extract all text from this image accurately. 
        If it's a document, preserve the formatting as much as possible. 
        If it's a casual photo, just list the visible text. 
        Output the text directly in a clean format.`;

        const result = await aiProvider.chat(ocrPrompt, { 
            image: base64Image,
            systemInstruction: "You are a professional OCR assistant. Your goal is to extract text from images with 100% accuracy, preserving structure and language.",
            task: 'VISION'
        });
        const extractedText = result.text;

        if (!extractedText || extractedText.includes('[Error]')) {
            throw new Error('Gagal mengekstrak teks dari gambar.');
        }

        await react(sock, m, '✅');
        
        return await sock.sendMessage(remoteJid, { 
            text: `📝 *HASIL OCR (TEXT EXTRACTION)*\n\n${extractedText}\n\n_Bot berhasil mengekstrak teks di atas._` 
        }, { quoted: m });

    } catch (error) {
        log.error('OCR error:', error.message);
        await react(sock, m, '❌');
        await sock.sendMessage(remoteJid, { text: `⚠️ Gagal melakukan OCR: ${error.message}` }, { quoted: m });
    }
};
