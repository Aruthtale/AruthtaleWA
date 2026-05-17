import { googleService } from '../../services/googleService.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

/**
 * Command: !google
 * Handles Google Login and Status
 */
export default async (sock, m, args) => {
    const subCommand = args[0]?.toLowerCase();
    const remoteJid = m.key.remoteJid;

    try {
        if (subCommand === 'login') {
            const url = await googleService.getAuthUrl();
            await react(sock, m, '🔑');
            await sock.sendMessage(remoteJid, {
                text: `🔐 *GOOGLE LOGIN REQUIRED*\n\nSilakan klik link di bawah untuk memberikan izin akses:\n\n${url}\n\nSetelah login, Anda akan mendapatkan *CODE*. Silakan balas pesan ini dengan perintah:\n*!google code <YOUR_CODE>*`
            }, { quoted: m });
            return;
        }

        if (subCommand === 'code') {
            const code = args[1];
            if (!code) return sock.sendMessage(remoteJid, { text: '❌ Masukkan kode yang Anda dapatkan dari link login.' });

            await react(sock, m, '⏳');
            await googleService.saveToken(code);
            await react(sock, m, '✅');
            return sock.sendMessage(remoteJid, { text: '✅ *Berhasil!* Bot sekarang terhubung dengan Google Tasks, Calendar, & Gmail.' });
        }

        // Default: Show Status
        const { hasToken } = await googleService.getAuthClient();
        const status = hasToken ? '✅ Terhubung' : '❌ Belum Terhubung';
        
        return sock.sendMessage(remoteJid, {
            text: `📂 *GOOGLE INTEGRATION STATUS*\n\nStatus: ${status}\n\n*Fitur Terintegrasi:*\n• Google Tasks (Sync !remind)\n• Google Calendar\n• Gmail (Auto-Notification)\n\n*Perintah Tersedia:*\n• !google login (PENTING: Gunakan ini lagi jika notifikasi email belum aktif)\n• !todo <pesan>\n• !jadwal <pesan>`
        }, { quoted: m });

    } catch (err) {
        log.error('Google Command Error:', err.message);
        return sock.sendMessage(remoteJid, { text: `❌ *Kesalahan:* ${err.message}` });
    }
};
