import axios from 'axios';
import { createSticker } from '../../utils/sticker.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

/**
 * Command: !linestiker
 * Downloads an entire LINE sticker pack and sends it to WA
 */
export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];

    if (!url || !url.includes('line.me')) {
        return sock.sendMessage(remoteJid, { 
            text: '❌ *Link Salah!*\nSilakan masukkan link LINE Sticker Pack.\n\nContoh:\n`!linestiker https://store.line.me/stickershop/product/12345/en`' 
        }, { quoted: m });
    }

    try {
        // Extract Product ID
        const productId = url.match(/product\/(\d+)/)?.[1];
        if (!productId) throw new Error('ID Product tidak ditemukan dalam link.');

        await react(sock, m, '⏳');
        await sock.sendMessage(remoteJid, { 
            text: '📦 *LINE STICKER PACK DOWNLOADER*\nSedang memproses paket stiker, mohon tunggu sebentar...' 
        }, { quoted: m });

        // 1. Get Metadata to find sticker IDs
        const metaUrl = `https://stickershop.line-scdn.net/stickershop/v1/product/${productId}/iphone/productInfo.meta`;
        const { data: meta } = await axios.get(metaUrl);

        const stickers = meta.stickers;
        if (!stickers || stickers.length === 0) throw new Error('Daftar stiker tidak ditemukan.');

        const total = stickers.length;
        const packName = meta.title?.en || meta.title?.ja || 'Line Sticker Pack';
        
        log.wa(`Downloading LINE Pack: ${packName} (${total} stickers)`);

        // Notify user about progress
        await sock.sendMessage(remoteJid, { text: `✅ Berhasil menemukan *${total}* stiker dari pack: *${packName}*.\nMemulai pengiriman...` });

        // 2. Loop and process each sticker
        for (let i = 0; i < stickers.length; i++) {
            try {
                const stickerId = stickers[i].id;
                // Using @2x.png for high quality
                const imageUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iphone/sticker@2x.png`;
                
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                
                // Convert to WhatsApp WebP format
                const stickerBuffer = await createSticker(buffer);
                
                // Send without quoted to avoid cluttering if it's a large pack
                await sock.sendMessage(remoteJid, { sticker: stickerBuffer });
                
                // Add a small delay every 5 stickers to avoid flooding
                if (i % 5 === 0) {
                    await new Promise(res => setTimeout(res, 800));
                }
            } catch (innerErr) {
                log.error(`Failed to process sticker ${i}:`, innerErr.message);
                // Continue to next sticker even if one fails
            }
        }

        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { text: `✨ *Selesai!* Seluruh stiker dari pack *${packName}* telah terkirim.` });

    } catch (err) {
        log.error('LineSticker Command Error:', err.message);
        let errorMsg = `❌ *Gagal mengambil sticker pack:* ${err.message}`;
        if (err.response?.status === 404) errorMsg = '❌ *Gagal:* Sticker pack tidak ditemukan atau link salah.';
        
        await react(sock, m, '❌');
        return sock.sendMessage(remoteJid, { text: errorMsg }, { quoted: m });
    }
};
