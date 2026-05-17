import { downloaderService } from '../../workers/downloader.js';
import { log } from '../../utils/logger.js';

export const help = `📸 *Bantuan !img*

Extract semua foto dari TikTok Slideshow atau link gallery.

*Format:* \`!img [url]\`
*Contoh:* \`!img https://vt.tiktok.com/...\`

*Kegunaan:* Mengirimkan setiap gambar dalam slideshow sebagai pesan gambar WhatsApp terpisah.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];

    if (!url) {
        return await sock.sendMessage(remoteJid, { text: `❌ Mana link gambarnya, Bos?\nFormat: *!img <url_slideshow>*` }, { quoted: m });
    }

    try {
        log.wa(`Image extraction request for: ${url}`);
        await sock.sendMessage(remoteJid, { text: `📸 *Extracting Images...*\nMohon tunggu, saya sedang mengumpulkan foto-fotonya.` }, { quoted: m });

        const senderNumber = remoteJid.split('@')[0];
        const { images, tempDir } = await downloaderService.downloadImages(url, senderNumber);

        if (images.length === 0) {
            return await sock.sendMessage(remoteJid, { text: `❌ Tidak ditemukan gambar murni di link tersebut. Mungkin formatnya bukan slideshow?` }, { quoted: m });
        }

        await sock.sendMessage(remoteJid, { text: `✅ Berhasil menemukan *${images.length}* gambar. Mengirim...` }, { quoted: m });

        // Send images one by one
        for (const imgPath of images) {
            await sock.sendMessage(remoteJid, { 
                image: { url: imgPath },
                caption: `🖼️ Aruthtale Image Service`
            });
            // Small delay to avoid spam detection
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        downloaderService.cleanup(tempDir);
    } catch (error) {
        log.error('Image command error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil gambar: ${error.message}` });
    }
};
