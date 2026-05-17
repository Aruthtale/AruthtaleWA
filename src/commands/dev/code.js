import { aiProvider } from '../../ai/provider.js';

export default async (sock, m, args) => {
    const query = args.join(' ');
    if (!query) {
        return await sock.sendMessage(m.key.remoteJid, { text: 'Berikan deskripsi kode yang ingin Anda buat.' });
    }

    const systemInstruction = 'You are an elite software engineer. Provide only high-quality, clean, and documented code. Keep explanations brief unless asked.';
    const result = await aiProvider.chat(query, { systemInstruction, task: 'CODE' });
    
    await sock.sendMessage(m.key.remoteJid, { text: result.text }, { quoted: m });
};
