import { webReader } from '../../services/webReader.js';
import { aiProvider } from '../../ai/provider.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];

    if (!url) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Sertakan link website yang ingin diringkas.\nContoh: `!summary https://berita.com/artikel`' 
        }, { quoted: m });
    }

    await sock.sendMessage(remoteJid, { text: '🔍 Sedang membaca website, mohon tunggu...' }, { quoted: m });
    
    try {
        const text = await webReader.extractText(url);
        const prompt = `Ringkas teks berikut menjadi 3 poin utama dalam bahasa Indonesia yang padat dan informatif:\n\n${text}`;
        const result = await aiProvider.chat(prompt, { 
            systemInstruction: "Kamu adalah asisten perangkas berita yang handal.",
            task: 'GENERAL'
        });

        return await sock.sendMessage(remoteJid, { 
            text: `📋 *RINGKASAN ARTIKEL*\n\n${result.text}\n\n_Sumber: ${url}_` 
        }, { quoted: m });
    } catch (error) {
        log.error('Summary error:', error.message);
        return await sock.sendMessage(remoteJid, { 
            text: `⚠️ *AI sedang sibuk atau link tidak bisa diakses.*\nMohon coba beberapa saat lagi atau gunakan link lain.` 
        }, { quoted: m });
    }
};
