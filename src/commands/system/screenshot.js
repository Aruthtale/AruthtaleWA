import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { log } from '../../utils/logger.js';
import { LINUX_ENV } from '../../utils/system.js';

const execAsync = promisify(exec);

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const filename = `screenshot_${Date.now()}.png`;
    const tempPath = path.join(process.cwd(), 'temp', filename);

    try {
        log.system('Capturing screenshot via spectacle...');
        
        // Ensure temp directory exists
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Capture screenshot with Environment Variables
        // Supporting both X11 and Wayland
        const env = LINUX_ENV;
        await execAsync(`${env} spectacle -b -n -o "${tempPath}"`);

        if (fs.existsSync(tempPath)) {
            await sock.sendMessage(remoteJid, { 
                image: fs.readFileSync(tempPath), 
                caption: `📸 Desktop Screenshot\nCaptured at: ${new Date().toLocaleString()}`
            }, { quoted: m });
        } else {
            throw new Error('Screenshot file not created.');
        }
    } catch (error) {
        log.error('Screenshot Error:', error.message);
        await sock.sendMessage(remoteJid, { text: `[Error] Gagal mengambil screenshot: ${error.message}` });
    } finally {
        // Robust Cleanup: Always delete temp file if it exists
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
                log.system('Cleaned up temporary screenshot file.');
            } catch (cleanupError) {
                log.error('Cleanup Error:', cleanupError.message);
            }
        }
    }
};
