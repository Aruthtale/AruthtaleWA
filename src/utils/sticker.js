import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from './logger.js';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Convert image buffer to sticker-compatible WebP (Static)
 * @param {Buffer} buffer 
 * @returns {Promise<Buffer>}
 */
export const createSticker = async (buffer) => {
    try {
        return await sharp(buffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ lossless: false, quality: 75 })
            .toBuffer();
    } catch (error) {
        log.error('Static sticker conversion failed:', error.message);
        throw error;
    }
};

/**
 * Convert video/gif file to animated sticker (WebP)
 * @param {string} inputPath 
 * @returns {Promise<string>} Path to the resulting webp file
 */
export const createAnimatedSticker = async (inputPath) => {
    const outputPath = path.join(os.tmpdir(), `sticker_${Date.now()}.webp`);
    try {
        log.system(`Converting video to animated sticker: ${inputPath}`);
        
        // WhatsApp Animated Sticker Requirements:
        // 1. WebP format
        // 2. 512x512 pixels
        // 3. Max duration: 6 seconds (standard is 3-5s)
        // 4. File size < 1MB
        // 5. Framerate < 30fps
        
        const cmd = `ffmpeg -i "${inputPath}" ` +
                    `-vcodec libwebp -filter:v "fps=fps=12,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" ` +
                    `-lossless 0 -compression_level 6 -q:v 40 -loop 0 -preset default -an -vsync 0 -t 00:00:04 ` +
                    `"${outputPath}" -y`;
        
        await execAsync(cmd);
        return outputPath;
    } catch (error) {
        const ffmpegError = error.stderr || error.message;
        log.error('Animated sticker conversion failed:', ffmpegError);
        throw new Error('Gagal mengonversi video ke sticker. Pastikan format video didukung.');
    }
};

export default createSticker;
