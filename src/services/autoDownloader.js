import fs from 'fs';
import { log } from '../utils/logger.js';
import { downloaderService } from '../workers/downloader.js';
import { usageService } from './usageService.js';
import { react } from '../utils/react.js';

export const autoDownloader = {
    handle: async (sock, m, remoteJid, url, senderNumber) => {
        log.wa(`Detected auto-media URL: ${url}`);
        let tempDir;
        try {
            await react(sock, m, '⏳');
            await sock.sendMessage(remoteJid, { text: `🎬 *Auto-Batch Download Detected!*\nSedang memproses, tunggu sebentar...` }, { quoted: m });
            
            const result = await downloaderService.download(url);
            tempDir = result.tempDir;
            
            for (const file of result.files) {
                const stats = fs.statSync(file.filePath);
                const fileSizeInMB = stats.size / (1024 * 1024);
                
                const mediaOptions = { caption: `✅ ${file.title}` };
                if (fileSizeInMB > 64) {
                    mediaOptions.document = { url: file.filePath };
                } else {
                    mediaOptions.video = { url: file.filePath };
                }
                await sock.sendMessage(remoteJid, mediaOptions);
            }
            await react(sock, m, '✅');
            if (result.totalSizeMb) await usageService.logUsage(senderNumber, 'DOWNLOAD_MB', result.totalSizeMb);
        } catch (error) {
            log.error('Auto-downloader error:', error.message);
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ Gagal download: ${error.message}` });
        } finally {
            if (tempDir) downloaderService.cleanup(tempDir);
        }
    }
};
