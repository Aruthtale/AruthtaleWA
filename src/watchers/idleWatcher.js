import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { aiProvider } from '../ai/provider.js';

const execAsync = promisify(exec);
let isIdleNotified = false;

export const startIdleWatcher = (sock) => {
    log.system('Starting Idle Watcher (KDE DBus)...');
    
    setInterval(async () => {
        try {
            // KDE Plasma specific idle time check (returns seconds)
            const { stdout } = await execAsync('qdbus org.kde.screensaver /ScreenSaver GetSessionIdleTime');
            const idleSeconds = parseInt(stdout.trim());
            const thresholdSeconds = settings.idleThreshold / 1000;

            if (idleSeconds >= thresholdSeconds && !isIdleNotified) {
                log.warn(`System is idle for ${idleSeconds}s. Sending notification...`);
                
                // Trigger !screenshot logic manually
                const screenshotCmd = await import('../commands/system/screenshot.js');
                const ownerJid = settings.ownerNumber.includes('@') ? settings.ownerNumber : `${settings.ownerNumber}@s.whatsapp.net`;
                
                await screenshotCmd.default(sock, { key: { remoteJid: ownerJid } }, []);
                
                await sock.sendMessage(ownerJid, { 
                    text: `⚠️ *Idle Alert*\nSistem sudah tidak aktif selama ${Math.floor(idleSeconds/60)} menit. Apakah Anda masih di sana?` 
                });
                
                isIdleNotified = true;
            } else if (idleSeconds < thresholdSeconds) {
                isIdleNotified = false;
            }
        } catch (error) {
            // log.error('Idle Watcher Error:', error.message);
        }
    }, 60000); // Check every minute
};
