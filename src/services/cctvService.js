import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { log } from '../utils/logger.js';

const execAsync = promisify(exec);

export const cctvService = {
    /**
     * Capture a single frame from an m3u8 stream
     * @param {string} url 
     * @returns {Promise<string>} Path to the captured image
     */
    captureFrame: async (url) => {
        const outputPath = path.join(os.tmpdir(), `cctv_${Date.now()}.jpg`);
        const isM3u8 = url.split('?')[0].toLowerCase().endsWith('.m3u8');
        
        try {
            if (!isM3u8) {
                // If it's a portal URL, go straight to screenshot
                log.system(`Direct portal detected: ${url}`);
                return await cctvService.captureScreenshot(url, outputPath);
            }

            log.system(`Capturing CCTV frame from stream: ${url}`);
            const cmd = `ffmpeg -reconnect 1 -reconnect_at_eof 1 -reconnect_streamed 1 -reconnect_delay_max 2 -user_agent "Mozilla/5.0" -i "${url}" -frames:v 1 -q:v 2 "${outputPath}" -y`;
            await execAsync(cmd, { timeout: 15000 });
            
            if (!fs.existsSync(outputPath)) {
                throw new Error('Gagal menghasilkan gambar dari stream.');
            }
            
            return outputPath;
        } catch (error) {
            log.error('CCTV Capture failed, trying fallback:', error.message);
            
            // Final fallback attempt with screenshot
            try {
                return await cctvService.captureScreenshot(url, outputPath);
            } catch (fallbackError) {
                log.error('Fallback screenshot failed:', fallbackError.message);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                throw new Error('Stream CCTV tidak dapat diakses atau sedang offline.');
            }
        }
    },

    /**
     * Capture screenshot using headless chrome
     * @param {string} url 
     * @param {string} outputPath 
     * @returns {Promise<string>}
     */
    captureScreenshot: async (url, outputPath) => {
        log.system(`Capturing screenshot from portal: ${url}`);
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const tempRawPath = outputPath.replace('.jpg', '_raw.png');
        
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const cmd = `google-chrome --headless --no-sandbox --disable-gpu --screenshot="${tempRawPath}" --window-size=1366,768 --hide-scrollbars --virtual-time-budget=25000 --user-agent="${userAgent}" --no-first-run --no-default-browser-check "${url}"`;
        
        log.info(`Executing Chrome: ${cmd}`);
        await execAsync(cmd, { timeout: 45000 });
        
        if (!fs.existsSync(tempRawPath) || fs.statSync(tempRawPath).size < 1000) {
            log.warn('Screenshot failed, trying direct fallback...');
            const fallbackCmd = `google-chrome --headless --no-sandbox --disable-gpu --screenshot="${tempRawPath}" --window-size=1280,720 --user-agent="${userAgent}" "${url}"`;
            await execAsync(fallbackCmd, { timeout: 35000 });
        }

        if (fs.existsSync(tempRawPath)) {
            try {
                // 🪄 Use Sharp to trim and optimize (like Spotify command)
                await sharp(tempRawPath)
                    .trim() // Remove white borders
                    .jpeg({ quality: 85 })
                    .toFile(outputPath);
                
                if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
                return outputPath;
            } catch (err) {
                log.error('Sharp processing failed:', err.message);
                // Fallback: move raw to output if sharp fails
                fs.renameSync(tempRawPath, outputPath);
                return outputPath;
            }
        }

        throw new Error('Gagal menghasilkan screenshot dari portal. Mohon coba lagi nanti.');
    },

    /**
     * Load CCTV sources from data file
     */
    getSources: () => {
        try {
            const data = fs.readFileSync(path.join(process.cwd(), 'src/data/cctv.json'), 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            log.error('Failed to load CCTV sources:', e);
            return [];
        }
    }
};

export default cctvService;
