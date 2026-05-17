import { aiProvider } from '../../ai/provider.js';

export default async (sock, m, args) => {
    const prompt = args.join(' ');
    if (!prompt) {
        return await sock.sendMessage(m.key.remoteJid, { text: 'Silakan berikan pertanyaan setelah perintah !ask.' });
    }

    const result = await aiProvider.chat(prompt, { task: 'GENERAL' });
    await sock.sendMessage(m.key.remoteJid, { text: result.text }, { quoted: m });
};
