import { healthService } from '../../system/health.js';
import { spotifyService } from '../../system/spotify.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const stats = await healthService.getSystemStats();
    
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;

    let status = `📊 *ARUTHTALE STATUS OVERVIEW*\n\n`;
    status += `🟢 *Bot Status:* Online\n`;
    status += `⏱️ *Uptime:* ${uptimeFormatted}\n`;
    status += `🧠 *System RAM:* ${stats.ram.used}/${stats.ram.total} GB (${stats.ram.percent}%)\n`;
    status += `🔥 *CPU Load:* ${stats.cpu.load}%\n`;
    status += `🔋 *Battery:* ${stats.battery.percent}% (${stats.battery.status})\n`;
    
    // Spotify Context
    try {
        if (spotifyService.isInitialized) {
            const track = await spotifyService.getMyCurrentPlaybackState();
            status += `🎵 *Spotify:* ${track && track.is_playing ? 'Playing' : 'Paused'}\n`;
        } else {
            status += `🎵 *Spotify:* Disconnected\n`;
        }
    } catch (e) {
        status += `🎵 *Spotify:* Error\n`;
    }

    status += `\n_Gunakan *!doctor* untuk diagnosa mendalam._`;

    await sock.sendMessage(remoteJid, { text: status }, { quoted: m });
};
