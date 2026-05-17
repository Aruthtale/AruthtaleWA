import { authService } from '../../services/authService.js';
import { settings } from '../../config/settings.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;

    if (!isOwner) {
        return await sock.sendMessage(remoteJid, { text: '❌ Hanya Owner yang bisa mengelola hak akses.' }, { quoted: m });
    }

    const command = args[0];

    if (command === 'add') {
        const targetNumber = args[1];
        const name = args.slice(2).join(' ') || 'User Terverifikasi';

        if (!targetNumber) {
            return await sock.sendMessage(remoteJid, { text: '❌ Masukkan nomor WhatsApp. Contoh: *!auth add 628123xxx Nama*' }, { quoted: m });
        }

        try {
            await authService.addAuthorized(targetNumber, name);
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil memverifikasi *${name}* (${targetNumber}).` }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal: ${err.message}` }, { quoted: m });
        }
    } 
    else if (command === 'list') {
        try {
            const list = await authService.listAuthorized();
            if (list.length === 0) {
                return await sock.sendMessage(remoteJid, { text: 'ℹ️ Belum ada user tambahan di database.' }, { quoted: m });
            }

            let text = '📋 *DAFTAR USER TERVERIFIKASI* 📋\n\n';
            list.forEach((u, i) => {
                text += `${i + 1}. ${u.name} (${u.number})\n`;
            });
            await sock.sendMessage(remoteJid, { text }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil daftar: ${err.message}` }, { quoted: m });
        }
    }
    else if (command === 'del') {
        const targetNumber = args[1];
        if (!targetNumber) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan nomor yang akan dihapus.' });

        try {
            await authService.removeAuthorized(targetNumber);
            await sock.sendMessage(remoteJid, { text: `✅ User ${targetNumber} telah dihapus dari whitelist.` }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal: ${err.message}` });
        }
    }
    else {
        await sock.sendMessage(remoteJid, { 
            text: `🛠️ *ADMIN AUTH CONTROL*\n\n` +
                  `• *!auth add <nomor> <nama>* : Tambah user\n` +
                  `• *!auth list* : Lihat semua user\n` +
                  `• *!auth del <nomor>* : Hapus user`
        }, { quoted: m });
    }
};
