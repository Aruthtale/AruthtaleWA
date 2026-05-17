import { systemControl } from '../../system/systemControl.js';

export default async (sock, m, args) => {
    const textToCopy = args.join(' ');
    if (!textToCopy) return await sock.sendMessage(m.key.remoteJid, { text: '❌ Sertakan teks yang ingin disalin.' });
    await systemControl.copyToClipboard(textToCopy);
    return await sock.sendMessage(m.key.remoteJid, { text: '📋 Teks berhasil disalin ke clipboard laptop.' }, { quoted: m });
};
