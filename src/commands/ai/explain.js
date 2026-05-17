import { aiProvider } from '../../ai/provider.js';

export default async (sock, m, args) => {
    const topic = args.join(' ');
    if (!topic) {
        return await sock.sendMessage(m.key.remoteJid, { text: 'Berikan kode atau konsep yang ingin dijelaskan.' });
    }

    const systemInstruction = 'You are a technical mentor. Explain the provided code or concept clearly, using analogies where helpful, and highlighting best practices.';
    const result = await aiProvider.chat(topic, { systemInstruction, task: 'BACKEND' });
    
    await sock.sendMessage(m.key.remoteJid, { text: result.text }, { quoted: m });
};
