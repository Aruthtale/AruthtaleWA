import { aiProvider } from '../../ai/provider.js';

export default async (sock, m, args) => {
    const errorLog = args.join(' ');
    if (!errorLog) {
        return await sock.sendMessage(m.key.remoteJid, { text: 'Tempelkan error log yang ingin Anda debug.' });
    }

    const systemInstruction = 'You are a debugging expert. Analyze the provided error log, identify the root cause, and suggest a precise fix. Be concise and technical.';
    const result = await aiProvider.chat(errorLog, { systemInstruction, task: 'DEBUG' });
    
    await sock.sendMessage(m.key.remoteJid, { text: result.text }, { quoted: m });
};
