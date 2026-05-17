import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { log } from '../utils/logger.js';
import { settings } from '../config/settings.js';
import { cacheService } from '../services/cacheService.js';
import { usageService } from '../services/usageService.js';

const execAsync = promisify(exec);
const DOWNLOAD_DIR = path.resolve(process.cwd(), 'temp/downloads');

/**
 * Maps technical errors to user-friendly messages
 * @param {Error|string} error 
 * @returns {string}
 */
const mapError = (error) => {
    const msg = typeof error === 'string' ? error : error.message;
    
    if (msg.includes('You need to log in') || msg.includes('posts are private') || msg.includes('private')) {
        return '❌ Akun ini bersifat *Private*. Bot tidak bisa mengaksesnya kecuali Anda mengunggah cookies dari akun yang memfollow user tersebut.';
    }
    if (msg.includes('Video unavailable') || msg.includes('not found') || msg.includes('404')) {
        return '❌ Konten tidak ditemukan atau sudah dihapus.';
    }
    if (msg.includes('Unsupported URL')) {
        return '❌ Link tidak didukung atau formatnya salah.';
    }
    if (msg.includes('Sign in to confirm you are not a bot') || msg.includes('IncompleteYouTubeResponse')) {
        return '❌ Terdeteksi bot oleh platform. Mohon coba lagi beberapa saat lagi atau gunakan cookies baru.';
    }
    if (msg.includes('Sign in to confirm your age')) {
        return '❌ Konten ini dibatasi usia (Age Restricted).';
    }
    
    return `❌ Terjadi kesalahan teknis: ${msg.split('\n')[0]}`;
};

/**
 * Generates a thumbnail for a video file
 * @param {string} videoPath 
 * @param {string} outputPath 
 */
const generateThumbnail = async (videoPath, outputPath) => {
    try {
        await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${outputPath}" -y`);
        return outputPath;
    } catch (err) {
        log.warn(`Failed to generate thumbnail: ${err.message}`);
        return null;
    }
};

/**
 * Embeds metadata into an MP3 file
 * @param {string} filePath 
 * @param {string} title 
 * @param {string} artist 
 */
const embedAudioMetadata = async (filePath, title, artist = 'Aruthtale AI') => {
    try {
        const tempPath = filePath.replace('.mp3', '_tagged.mp3');
        await execAsync(`ffmpeg -i "${filePath}" -metadata title="${title}" -metadata artist="${artist}" -c copy "${tempPath}" -y`);
        fs.renameSync(tempPath, filePath);
    } catch (err) {
        log.warn(`Failed to embed metadata: ${err.message}`);
    }
};

export const downloaderService = {
    /**
     * Download media from various platforms using yt-dlp
     * @param {string} url - The media URL
     * @returns {Promise<{files: Array<{filePath: string, title: string, duration: string}>}>}
     */
    download: async (url, userId) => {
        const timestamp = Date.now();
        const outputSubDir = path.join(DOWNLOAD_DIR, `batch_${timestamp}`);
        
        if (!fs.existsSync(outputSubDir)) fs.mkdirSync(outputSubDir, { recursive: true });

        log.info(`Starting batch download for: ${url}`);
        
        try {
            // 1. Route specific platforms to preferred tools
            const isIGStoryOrHighlight = url.includes('instagram.com/stories/') || url.includes('instagram.com/highlights/');
            
            if (isIGStoryOrHighlight) {
                log.info(`[Downloader] Instagram Story/Highlight detected, using gallery-dl strategy...`);
                // Force a throw to trigger the gallery-dl fallback immediately
                throw new Error('Unsupported URL: Instagram Story/Highlight requires specialized scraper');
            }

            // 2. Normal yt-dlp flow
            let entries = await cacheService.get(url);
            let stdoutRaw;
            
            const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            const browser = settings.browserCookies;
            const cookiesArg = settings.cookiesPath ? `--cookies "${settings.cookiesPath}"` : `--cookies-from-browser ${browser}`;

            if (!entries) {
                log.info(`Cache miss for ${url}, fetching fresh metadata...`);
                try {
                    const { stdout } = await execAsync(`yt-dlp --dump-json ${cookiesArg} --user-agent "${userAgent}" "${url}"`);
                    stdoutRaw = stdout;
                } catch (err) {
                    // Fallback for Instagram Stories if chrome fails and no static cookies file is provided
                    if (err.message.includes('log in') && browser === 'chrome' && !settings.cookiesPath) {
                        log.info('Chrome cookies failed for IG Story, trying Firefox fallback...');
                        const { stdout } = await execAsync(`yt-dlp --dump-json --cookies-from-browser firefox --user-agent "${userAgent}" "${url}"`);
                        stdoutRaw = stdout;
                    } else {
                        throw err;
                    }
                }
                
                const metadataLines = stdoutRaw.trim().split('\n');
                entries = metadataLines.map(line => JSON.parse(line));
                await cacheService.set(url, entries);
            } else {
                log.info(`Cache hit for ${url}`);
            }

            // 🛡️ Disk-Bomb Guard (200MB Max)
            const totalSize = entries.reduce((acc, entry) => acc + (entry.filesize || entry.filesize_approx || 0), 0);
            const MAX_SIZE = 200 * 1024 * 1024; // 200MB
            
            if (totalSize > MAX_SIZE) {
                const sizeInMB = (totalSize / (1024 * 1024)).toFixed(1);
                log.warn(`Download blocked: File too large (${sizeInMB}MB)`);
                throw new Error(`FILE_TOO_LARGE:${sizeInMB}`);
            }

            // Build yt-dlp command to download all into the subdir
            const finalCookiesArg = (stdoutRaw && stdoutRaw.includes('firefox') && !settings.cookiesPath) 
                ? '--cookies-from-browser firefox' 
                : (settings.cookiesPath ? `--cookies "${settings.cookiesPath}"` : `--cookies-from-browser ${settings.browserCookies}`);
                
            const command = `yt-dlp ` +
                            `-f "bestvideo[height<=720]+bestaudio/best[height<=720]/best" ` +
                            `--merge-output-format mp4 ` +
                            `${finalCookiesArg} ` +
                            `--user-agent "${userAgent}" ` +
                            `--no-warnings ` +
                            `-o "${outputSubDir}/%(playlist_index)s_%(title)s.%(ext)s" ` +
                            `"${url}"`;
            
            log.info(`Executing batch: ${command}`);
            await execAsync(command);

            // Find all downloaded mp4 files & generate thumbnails
            const files = [];
            const readdir = fs.readdirSync(outputSubDir).filter(f => f.endsWith('.mp4'));
            
            for (let i = 0; i < readdir.length; i++) {
                const fileName = readdir[i];
                const entry = entries[i] || entries[0];
                const filePath = path.join(outputSubDir, fileName);
                const thumbPath = filePath.replace('.mp4', '.jpg');
                
                await generateThumbnail(filePath, thumbPath);

                files.push({
                    filePath,
                    thumbnailPath: thumbPath,
                    title: entry.title || fileName,
                    duration: entry.duration_string || 'N/A'
                });
            }

            const totalSizeMb = (totalSize / (1024 * 1024)).toFixed(2);
            log.success(`Batch download complete: ${totalSizeMb}MB`);
            
            // 📊 Log Usage
            if (userId) {
                await usageService.logUsage(userId, 'DOWNLOAD_MB', totalSizeMb);
            }
            
            return { 
                files,
                tempDir: outputSubDir,
                totalSizeMb
            };
        } catch (error) {
            // 🔄 Fallback to gallery-dl for unsupported URLs (like IG Highlights)
            if (error.message.includes('Unsupported URL') || error.message.includes('Falling back on generic')) {
                log.info('yt-dlp failed with Unsupported URL, trying gallery-dl fallback...');
                try {
                    const cookiesArg = settings.cookiesPath ? `--cookies "${settings.cookiesPath}"` : `--cookies-from-browser ${settings.browserCookies}`;
                    const galleryCommand = `gallery-dl ${cookiesArg} -D "${outputSubDir}" "${url}"`;
                    await execAsync(galleryCommand);

                    // Find all downloaded files (mp4, jpg, etc)
                    const findFiles = (dir) => {
                        let results = [];
                        const list = fs.readdirSync(dir);
                        list.forEach(file => {
                            file = path.join(dir, file);
                            const stat = fs.statSync(file);
                            if (stat && stat.isDirectory()) {
                                results = results.concat(findFiles(file));
                            } else {
                                results.push(file);
                            }
                        });
                        return results;
                    };

                    const allFiles = findFiles(outputSubDir);
                    const files = [];
                    for (const f of allFiles) {
                        const thumbPath = f.endsWith('.mp4') ? f.replace('.mp4', '.jpg') : null;
                        if (thumbPath) await generateThumbnail(f, thumbPath);

                        files.push({
                            filePath: f,
                            thumbnailPath: thumbPath,
                            title: path.basename(f),
                            duration: 'N/A'
                        });
                    }

                    if (files.length > 0) {
                        return { files, tempDir: outputSubDir };
                    }
                } catch (galErr) {
                    log.error('Gallery-dl fallback also failed:', galErr.message);
                    throw new Error(mapError(galErr));
                }
            }

            log.error('Batch download error:', error.message);
            throw new Error(mapError(error));
        }
    },

    /**
     * Cleanup downloaded file
     * @param {string} filePath 
     */
    cleanup: (targetPath) => {
        if (!targetPath || !targetPath.includes('temp/downloads')) return;
        try {
            if (fs.existsSync(targetPath)) {
                if (fs.lstatSync(targetPath).isDirectory()) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(targetPath);
                }
                log.info(`Cleaned up: ${path.basename(targetPath)}`);
            }
        } catch (error) {
            log.error('Cleanup error:', error.message);
        }
    },

    /**
     * Download individual images from a gallery/slideshow
     * @param {string} url 
     * @returns {Promise<string[]>} Array of image file paths
     */
    downloadImages: async (url, userId) => {
        const timestamp = Date.now();
        const outputSubDir = path.join(DOWNLOAD_DIR, `img_${timestamp}`);
        
        if (!fs.existsSync(outputSubDir)) fs.mkdirSync(outputSubDir, { recursive: true });

        log.info(`Extracting images from: ${url}`);
        
        try {
            // gallery-dl -d <directory> <url>
            // Switched to configured browser and added User-Agent for better spoofing
            const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            const browser = settings.browserCookies;
            const cookiesArg = settings.cookiesPath ? `--cookies "${settings.cookiesPath}"` : `--cookies-from-browser ${browser}`;
            
            let command = `gallery-dl ${cookiesArg} --user-agent "${userAgent}" -D "${outputSubDir}" "${url}"`;
            
            try {
                await execAsync(command);
            } catch (err) {
                if (err.message.includes('log in') && browser === 'chrome' && !settings.cookiesPath) {
                    log.info('Chrome cookies failed for gallery-dl, trying Firefox fallback...');
                    command = `gallery-dl --cookies-from-browser firefox --user-agent "${userAgent}" -D "${outputSubDir}" "${url}"`;
                    await execAsync(command);
                } else {
                    throw err;
                }
            }

            // Recursively find all images in the output directory
            const findFiles = (dir) => {
                let results = [];
                const list = fs.readdirSync(dir);
                list.forEach(file => {
                    file = path.join(dir, file);
                    const stat = fs.statSync(file);
                    if (stat && stat.isDirectory()) {
                        results = results.concat(findFiles(file));
                    } else {
                        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
                            results.push(file);
                        }
                    }
                });
                return results;
            };

            const images = findFiles(outputSubDir);
            return {
                images,
                tempDir: outputSubDir
            };
        } catch (error) {
            log.error('Image download error:', error.message);
            throw error;
        }
    },

    /**
     * Download audio only (MP3) from various platforms
     * @param {string} url 
     * @returns {Promise<{files: Array<{filePath: string, title: string, duration: string}>}>}
     */
    downloadAudio: async (url, userId) => {
        const timestamp = Date.now();
        const outputSubDir = path.join(DOWNLOAD_DIR, `audio_${timestamp}`);
        
        if (!fs.existsSync(outputSubDir)) fs.mkdirSync(outputSubDir, { recursive: true });

        log.info(`Starting audio extraction for: ${url}`);
        
        try {
            // Check Cache First
            let entries = await cacheService.get(url);
            
            const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            const cookiesArg = settings.cookiesPath ? `--cookies "${settings.cookiesPath}"` : `--cookies-from-browser ${settings.browserCookies}`;
            
            if (!entries) {
                log.info(`Cache miss for audio ${url}, fetching fresh metadata...`);
                const { stdout: stdoutRaw } = await execAsync(`yt-dlp --dump-json ${cookiesArg} --user-agent "${userAgent}" "${url}"`);
                const metadataLines = stdoutRaw.trim().split('\n');
                entries = metadataLines.map(line => JSON.parse(line));
                await cacheService.set(url, entries);
            } else {
                log.info(`Cache hit for audio ${url}`);
            }

            // 2. Download & Extract Audio
            const command = `yt-dlp ` +
                            `-x --audio-format mp3 ` +
                            `--audio-quality 0 ` +
                            `${cookiesArg} ` +
                            `--user-agent "${userAgent}" ` +
                            `--no-warnings ` +
                            `-o "${outputSubDir}/%(playlist_index)s_%(title)s.%(ext)s" ` +
                            `"${url}"`;
            
            log.info(`Executing audio extraction: ${command}`);
            await execAsync(command);

            // 3. Find files & Tag metadata
            const files = [];
            const readdir = fs.readdirSync(outputSubDir).filter(f => f.endsWith('.mp3'));
            
            for (let i = 0; i < readdir.length; i++) {
                const fileName = readdir[i];
                const entry = entries[i] || entries[0];
                const filePath = path.join(outputSubDir, fileName);
                
                await embedAudioMetadata(filePath, entry.title, entry.uploader || 'Aruthtale AI');

                files.push({
                    filePath,
                    title: entry.title || fileName,
                    duration: entry.duration_string || 'N/A'
                });
            }

            return { 
                files,
                tempDir: outputSubDir
            };
        } catch (error) {
            log.error('Audio download error:', error.message);
            throw new Error(mapError(error));
        }
    },


};
