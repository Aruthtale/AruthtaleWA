import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { createSticker } from '../../utils/sticker.js';
import { log } from '../../utils/logger.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const help = `✨ *Bantuan !stiker*
 
 Membuat stiker WhatsApp dari gambar atau video pendek.
 
 *Format:*
 1. Balas gambar/video dengan perintah \`!stiker\`
 2. Kirim gambar dengan caption \`!stiker\`
 3. Gunakan link: \`!stiker https://link-gambar.com/foto.jpg\`
 
 *Syarat:*
 - Authorized users only.
 - Gambar/Video max 5MB.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    
    // Check if it's an image message or a reply to an image message
    const message = m.message?.imageMessage || 
                    m.message?.videoMessage || 
                    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

    try {
        log.wa(`Processing sticker for: ${remoteJid}`);
        let buffer;

        // Check if there's a URL in args
        const urlMatch = args[0] && args[0].match(/https?:\/\/[^\s]+/);
        
        if (urlMatch) {
            let targetUrl = urlMatch[0];
            log.wa(`Handling URL for sticker: ${targetUrl}`);

            // 📍 Pinterest Scraper
            if (targetUrl.includes('pin.it') || targetUrl.includes('pinterest.com')) {
                try {
                    const { data: html } = await axios.get(targetUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                    const $ = cheerio.load(html);
                    const ogImage = $('meta[property="og:image"]').attr('content');
                    if (ogImage) {
                        targetUrl = ogImage;
                        log.info(`Scraped Pinterest direct URL: ${targetUrl}`);
                    }
                } catch (e) {
                    log.warn(`Pinterest scraping failed, trying direct download: ${e.message}`);
                }
            }

            const response = await axios.get(targetUrl, { 
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });

            if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
                throw new Error('Link yang diberikan adalah halaman web, bukan gambar langsung.');
            }

            buffer = Buffer.from(response.data);
        } else {
            if (!message) {
                return await sock.sendMessage(remoteJid, { text: '❌ Balas gambar/video atau kirim link gambar yang ingin dijadikan stiker.' }, { quoted: m });
            }

            // Download the media from message
            buffer = await downloadMediaMessage(
                m.message?.extendedTextMessage?.contextInfo?.quotedMessage ? 
                    { message: m.message.extendedTextMessage.contextInfo.quotedMessage } : m,
                'buffer',
                {},
                { 
                    logger: log,
                    reuploadRequest: sock.updateMediaMessage
                }
            );
        }

        if (!buffer) throw new Error('Gagal mendapatkan media.');

        const stickerBuffer = await createSticker(buffer);

        await sock.sendMessage(remoteJid, { 
            sticker: stickerBuffer 
        }, { quoted: m });

    } catch (error) {
        log.error('Sticker creation error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membuat stiker: ${error.message}` }, { quoted: m });
    }
};
