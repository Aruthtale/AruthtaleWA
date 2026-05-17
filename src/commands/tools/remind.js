import { reminderService } from '../../services/reminderService.js';

export const help = `⏰ *Bantuan !remind*

Gunakan perintah ini untuk membuat pengingat otomatis.

*Format:* \`!remind [pesan] [waktu]\`
*Contoh:*
- \`!remind minum obat 15 menit lagi\`
- \`!remind meeting besok jam 9 pagi\`
- \`!remind jemput adik jam 17:00\`

Bot akan mengirim pesan WhatsApp saat waktunya tiba. Pengingat ini tetap tersimpan meskipun bot mati.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const rawText = args.join(' ');

    if (!rawText) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Sertakan pesan pengingat.\nContoh: `!remind minum kopi 15 menit lagi`' 
        }, { quoted: m });
    }

    try {
        const { time, message } = await reminderService.parseReminder(rawText);
        await reminderService.schedule(time, message, remoteJid);
        
        return await sock.sendMessage(remoteJid, { 
            text: `⏰ *Pengingat Dijadwalkan!*\n\n📌 *Pesan:* ${message}\n📅 *Waktu:* ${time}\n\nBot akan mengirim notifikasi ke laptopmu.` 
        }, { quoted: m });
    } catch (error) {
        return await sock.sendMessage(remoteJid, { text: `❌ ${error.message}` }, { quoted: m });
    }
};
