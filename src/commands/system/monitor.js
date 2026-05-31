import os from 'os';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const uptime = Math.floor(os.uptime() / 3600);
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100;
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100;
    const cpuLoad = os.loadavg()[0].toFixed(2);

    const report = `💻 *On-Demand System Monitor*\n\n` +
                   `⏱️ *Uptime:* ${uptime} hours\n` +
                   `🧠 *RAM:* ${Math.round((totalMem - freeMem) * 10) / 10}GB / ${totalMem}GB used\n` +
                   `⚡ *CPU Load:* ${cpuLoad} (1m avg)\n\n` +
                   `_System is stable._`;

    await sock.sendMessage(remoteJid, { text: report }, { quoted: m });
};

export const help = `*!sys monitor* - Menampilkan status hardware real-time.`;
