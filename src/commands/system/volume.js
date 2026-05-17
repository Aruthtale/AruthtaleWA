import { systemControl } from '../../system/systemControl.js';

export default async (sock, m, args) => {
    const level = args[0] || 50;
    const vol = await systemControl.setVolume(level);
    return await sock.sendMessage(m.key.remoteJid, { text: `🔊 Volume diatur ke ${vol}%` }, { quoted: m });
};
