import os from 'os';
import fs from 'fs';
import path from 'path';

const getDirSize = (dir) => {
    try {
        const files = fs.readdirSync(dir);
        let size = 0;
        files.forEach(file => {
            const stats = fs.statSync(path.join(dir, file));
            size += stats.size;
        });
        return (size / 1024 / 1024).toFixed(1);
    } catch { return 0; }
};

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const uptime = Math.floor(os.uptime() / 86400) + 'd ' + Math.floor((os.uptime() % 86400) / 3600) + 'h ' + Math.floor((os.uptime() % 3600) / 60) + 'm';
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const usedMem = (totalMem - freeMem).toFixed(1);
    const cpuLoad = Math.round(os.loadavg()[0] * 10);
    const bar = '█'.repeat(cpuLoad / 10) + '░'.repeat(10 - Math.round(cpuLoad / 10));

    const report = `🤖 *[ARUTHTALE SYSTEM STATUS]*\n` +
                   `----------------------------------\n` +
                   `OS      : EndeavourOS (KDE)\n` +
                   `Uptime  : ${uptime}\n` +
                   `Engine  : Node.js ${process.version}\n\n` +
                   `[HARDWARE]\n` +
                   `├── CPU : ${cpuLoad}% [${bar}]\n` +
                   `├── RAM : ${usedMem}GB / ${totalMem}GB\n` +
                   `└── TMP : ${getDirSize('temp')}MB / 512MB (Ramdisk)\n\n` +
                   `[OSINT ENGINE]\n` +
                   `├── Holehe  : Ready (v1.61)\n` +
                   `└── Sherlock: Ready (v0.16)\n` +
                   `----------------------------------`;

    await sock.sendMessage(remoteJid, { text: report }, { quoted: m });
};

export const help = `*!sys dashboard* - Menampilkan status sistem estetik.`;
