import { browserService } from '../../services/browserService.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const url = args[0];

    if (!url) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Sertakan link website yang ingin di-screenshot.\nContoh: `!webss https://google.com`' 
        }, { quoted: m });
    }

    // Validasi URL sederhana
    if (!url.startsWith('http')) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Format URL tidak valid. Pastikan dimulai dengan http:// atau https://' 
        }, { quoted: m });
    }

    await sock.sendMessage(remoteJid, { text: '📸 Sedang mengambil tangkapan layar website, mohon tunggu...' }, { quoted: m });

    try {
        const screenshot = await browserService.screenshot(url);
        
        await sock.sendMessage(remoteJid, { 
            image: screenshot, 
            caption: `🌐 *Website Screenshot*\nURL: ${url}\nCaptured at: ${new Date().toLocaleString()}`
        }, { quoted: m });

    } catch (error) {
        log.error('WebSS error:', error.message);
        return await sock.sendMessage(remoteJid, { 
            text: `⚠️ *Gagal mengambil screenshot.*\nError: ${error.message}` 
        }, { quoted: m });
    }
};
