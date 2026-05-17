import { systemControl } from '../../system/systemControl.js';

export default async (sock, m, args) => {
    const level = args[0] || 50;
    const bright = await systemControl.setBrightness(level);
    return await sock.sendMessage(m.key.remoteJid, { text: `☀️ Kecerahan diatur ke ${bright}%` }, { quoted: m });
};
