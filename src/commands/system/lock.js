import { systemControl } from '../../system/systemControl.js';

export default async (sock, m) => {
    await systemControl.lock();
    return await sock.sendMessage(m.key.remoteJid, { text: '🔒 Laptop berhasil dikunci.' }, { quoted: m });
};
