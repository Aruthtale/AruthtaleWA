import axios from 'axios';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { settings } from '../../config/settings.js';
import { log } from '../../utils/logger.js';

export const help = `🖼️ *Bantuan !removebg*

Menghapus latar belakang (background) dari sebuah foto.

*Format:* Balas sebuah foto dengan perintah \`!removebg\`

*Akses:* Authorized users.
*Syarat:* Memerlukan REMOVEBG_API_KEY di file .env`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const apiKey = process.env.REMOVEBG_API_KEY;

    if (!apiKey) {
        return await sock.sendMessage(remoteJid, { text: '❌ *REMOVEBG_API_KEY* belum dikonfigurasi di file .env. Silakan hubungi Owner.' }, { quoted: m });
    }

    const message = m.message?.imageMessage || 
                    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!message) {
        return await sock.sendMessage(remoteJid, { text: '❌ Balas foto yang ingin dihapus background-nya dengan perintah *!removebg*' }, { quoted: m });
    }

    try {
        log.wa(`Processing removebg for: ${remoteJid}`);
        const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang memproses foto...*' }, { quoted: m });

        const buffer = await downloadMediaMessage(
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage ? 
                { message: m.message.extendedTextMessage.contextInfo.quotedMessage } : m,
            'buffer',
            {},
            { logger: log }
        );

        if (!buffer) throw new Error('Gagal mendownload media.');

        const formData = new FormData();
        formData.append('image_file', buffer, { filename: 'image.jpg' });
        formData.append('size', 'auto');

        const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': apiKey,
            },
            responseType: 'arraybuffer'
        });

        await sock.sendMessage(remoteJid, { 
            image: Buffer.from(response.data),
            caption: '✅ *Background removed!*'
        }, { quoted: m });

        await sock.sendMessage(remoteJid, { text: '✅ Selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('RemoveBG error:', error.message);
        const errorMsg = error.response?.data?.errors?.[0]?.title || error.message;
        await sock.sendMessage(remoteJid, { text: `❌ Gagal menghapus background: ${errorMsg}` }, { quoted: m });
    }
};
