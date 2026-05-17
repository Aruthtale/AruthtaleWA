import { systemControl } from '../../system/systemControl.js';

export default async (sock, m) => {
    await sock.sendMessage(m.key.remoteJid, { text: '💤 Laptop akan ditidurkan...' }, { quoted: m });
    return await systemControl.suspend();
};
