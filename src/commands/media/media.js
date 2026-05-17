import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../../utils/logger.js';

const execAsync = promisify(exec);

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const action = args[0]?.toLowerCase();

    if (!action) {
        return sock.sendMessage(remoteJid, { text: "Format: !media [play|pause|next|prev|status]" });
    }

    try {
        log.system(`Media action: ${action}`);
        
        if (action === 'status') {
            const { stdout: players } = await execAsync('playerctl -l');
            return sock.sendMessage(remoteJid, { text: `🎵 Player terdeteksi:\n${players || 'Tidak ada player aktif'}` });
        }

        // Jalankan perintah media dengan flag --all-players agar lebih agresif
        // Ini akan mencoba mengirim perintah ke semua aplikasi musik yang terdeteksi
        await execAsync(`playerctl ${action} --all-players`);
        
        await sock.sendMessage(remoteJid, { text: `✅ Media: ${action} (Sent to all players)` });
        
    } catch (error) {
        log.error(`Media Error: ${error.message}`);
        
        // Fallback: Coba targetkan spotify secara spesifik jika --all-players gagal
        try {
            await execAsync(`playerctl -p spotify ${action}`);
            return await sock.sendMessage(remoteJid, { text: `✅ Media: ${action} (Spotify Targeted)` });
        } catch (e) {
            // Jika tetap gagal, berikan info player yang ada
            const { stdout: players } = await execAsync('playerctl -l').catch(() => ({ stdout: '' }));
            await sock.sendMessage(remoteJid, { 
                text: `❌ Gagal: Player tidak merespons.\n\nPlayer aktif: \n${players || 'KOSONG'}\n\nPastikan Spotify diizinkan untuk dikontrol via Media Keys.` 
            });
        }
    }
};
