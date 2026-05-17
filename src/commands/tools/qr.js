import axios from 'axios';
import { log } from '../../utils/logger.js';

export const help = `📱 *Bantuan !qr*

Membuat QR Code dari teks atau link.

*Format:* \`!qr [teks/url]\`
*Contoh:* \`!qr https://google.com\`

*Akses:* Owner Only.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const text = args.join(' ');

    if (!text) {
        return await sock.sendMessage(remoteJid, { text: '❌ Masukkan teks atau link yang ingin dijadikan QR Code.' }, { quoted: m });
    }

    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
        
        await sock.sendMessage(remoteJid, { 
            image: { url: qrUrl },
            caption: `✅ *QR Code Generated*\n\n*Data:* ${text}`
        }, { quoted: m });

    } catch (error) {
        log.error('QR Code generation failed:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membuat QR Code: ${error.message}` }, { quoted: m });
    }
};
