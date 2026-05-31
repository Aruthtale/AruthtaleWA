import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { log } from './logger.js';
import { LINUX_ENV } from './system.js';

const execAsync = promisify(exec);
import { spotifyService } from '../system/spotify.js';
import { settings } from '../config/settings.js';
import { knowledgeService } from '../services/knowledge.js';
import { systemControl } from '../system/systemControl.js';

import os from 'os';

// --- SECURITY SETTINGS ---
const ALLOWED_BASE_PATH = os.homedir(); // Sandbox: AI hanya boleh akses file di dalam folder user

const isPathSafe = (targetPath) => {
    try {
        const resolvedPath = path.resolve(targetPath);
        // Ensure the path doesn't contain null bytes and is within home directory
        if (resolvedPath.includes('\0')) return false;
        return resolvedPath.startsWith(ALLOWED_BASE_PATH);
    } catch (e) {
        return false;
    }
};

export const fsTools = {
    get_project_context: async ({ action, projectName }) => {
        if (action === 'list') {
            return await knowledgeService.getProjectsSummary();
        }
        if (action === 'detail' && projectName) {
            return await knowledgeService.getProjectDetail(projectName);
        }
        return "Action tidak valid. Gunakan 'list' atau 'detail'.";
    },

    list_files: ({ directory }) => {
        const targetPath = path.resolve(directory || '.');
        if (!isPathSafe(targetPath)) return "❌ Akses Ditolak: Path di luar sandbox keamanan.";
        
        log.system(`AI listing files in: ${targetPath}`);
        try {
            return fs.readdirSync(targetPath).map(file => {
                const stats = fs.statSync(path.join(targetPath, file));
                return {
                    name: file,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.size
                };
            });
        } catch (err) {
            return `Gagal melisensi folder: ${err.message}`;
        }
    },

    read_file: ({ filePath }) => {
        const targetPath = path.resolve(filePath);
        if (!isPathSafe(targetPath)) return "❌ Akses Ditolak: Tidak diizinkan membaca file di luar sandbox.";
        
        log.system(`AI reading file: ${targetPath}`);
        try {
            return fs.readFileSync(targetPath, 'utf8');
        } catch (err) {
            return `Gagal membaca file: ${err.message}`;
        }
    },

    write_file: ({ path: filePath, content }) => {
        const targetPath = path.resolve(filePath);
        if (!isPathSafe(targetPath)) return "❌ Akses Ditolak: Tidak diizinkan menulis file di luar sandbox.";
        
        log.system(`AI writing file: ${targetPath}`);
        try {
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, content, 'utf8');
            return `Berhasil menulis file ke ${filePath}`;
        } catch (err) {
            return `Gagal menulis file: ${err.message}`;
        }
    },

    make_directory: ({ directory }) => {
        const targetPath = path.resolve(directory);
        if (!isPathSafe(targetPath)) return "❌ Akses Ditolak: Sandbox limitation.";
        
        log.system(`AI creating directory: ${targetPath}`);
        try {
            fs.mkdirSync(targetPath, { recursive: true });
            return `Berhasil membuat direktori ${directory}`;
        } catch (err) {
            return `Gagal membuat direktori: ${err.message}`;
        }
    },

    get_file_info: ({ filePath }) => {
        const targetPath = path.resolve(filePath);
        if (!isPathSafe(targetPath)) return "❌ Akses Ditolak: Sandbox limitation.";
        
        try {
            const stats = fs.statSync(targetPath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile()
            };
        } catch (err) {
            return `Gagal mengambil info file: ${err.message}`;
        }
    },

    launch_app: ({ binaryName }) => {
        // Whitelist aplikasi yang boleh dibuka (opsional, tapi disarankan)
        const blockedApps = ['rm', 'shutdown', 'reboot', 'mkfs'];
        if (blockedApps.some(app => binaryName.includes(app))) {
            return "❌ Keamanan: Aplikasi ini dilarang untuk dibuka.";
        }

        // Sanitize input to prevent shell injection
        const sanitizedBinary = binaryName.replace(/[^a-zA-Z0-9\-\._\s\/]/g, '');
        if (sanitizedBinary !== binaryName) {
            return "❌ Keamanan: Karakter ilegal terdeteksi dalam nama aplikasi.";
        }

        log.system(`AI launching application: ${sanitizedBinary}`);
        const cmd = `nohup ${sanitizedBinary} > /dev/null 2>&1 &`;
        exec(cmd);
        return `Mencoba menjalankan ${sanitizedBinary} di background.`;
    },

    spotify_control: async ({ action, query }) => {
        log.system(`AI Spotify Control: ${action} ${query || ''}`);
        
        try {
            if (spotifyService.isInitialized) {
                switch (action) {
                    case 'play':
                        if (query === 'last') {
                            const recent = await spotifyService.getRecentlyPlayedTracks(1);
                            const lastTrack = recent.items[0]?.track;
                            if (lastTrack) {
                                await spotifyService.play({ uris: [lastTrack.uri] });
                                return `Memutar lagu terakhir kamu: ${lastTrack.name} oleh ${lastTrack.artists[0].name}`;
                            }
                        }
                        if (query) {
                            const search = await spotifyService.searchTracks(query, 1);
                            const track = search.tracks.items[0];
                            if (track) {
                                await spotifyService.play({ uris: [track.uri] });
                                return `Memutar lagu: ${track.name} oleh ${track.artists[0].name}`;
                            }
                        }
                        await spotifyService.play();
                        return "Melanjutkan pemutaran Spotify via Cloud API.";
                    case 'pause':
                        await spotifyService.pause();
                        return "Musik dijeda via Cloud API.";
                    case 'next':
                        await spotifyService.skipToNext();
                        return "Lagu berikutnya via Cloud API.";
                    case 'previous':
                        await spotifyService.skipToPrevious();
                        return "Lagu sebelumnya via Cloud API.";
                }
            }
        } catch (e) {
            log.warn('Spotify API failed, falling back to local...', e.message);
        }

        if (action === 'list' || action === 'history') {
            return `Tolong instruksikan pengguna untuk mengetik "!spotify list" secara manual.`;
        }

        if (action === 'play') {
            exec('pgrep spotify', (err) => {
                if (err) exec('gtk-launch spotify');
                setTimeout(() => exec('playerctl -p spotify play'), 2000);
            });
            return "Memproses perintah putar Spotify secara Lokal.";
        }

        const validActions = ['pause', 'next', 'previous'];
        if (validActions.includes(action)) {
            // Using spawn to avoid shell injection
            const safeAction = action === 'previous' ? 'previous' : action;
            spawn('playerctl', ['-p', 'spotify', safeAction]);
            return `Berhasil mengirim perintah ${action} ke Spotify Lokal.`;
        }

        return "Action tidak valid.";
    },

    system_control: async ({ action, level }) => {
        log.system(`AI System Control: ${action} ${level || ''}`);
        try {
            switch (action) {
                case 'volume':
                    await systemControl.setVolume(level);
                    return `Volume sistem diatur ke ${level}%`;
                case 'brightness':
                    await systemControl.setBrightness(level);
                    return `Kecerahan layar diatur ke ${level}%`;
                case 'lock':
                    await systemControl.lock();
                    return "Sesi dikunci.";
                case 'suspend':
                    await systemControl.suspend();
                    return "Sistem di-suspend.";
                case 'screenshot':
                    // We need a way to trigger the screenshot command logic.
                    // Since it's a bit complex (file handling), let's just use exec for now or import it.
                    // Actually, let's just use a simple exec for the AI tool version.
                    const screenshotPath = path.join(os.homedir(), `Pictures/Screenshots/screenshot_${Date.now()}.png`);
                    await execAsync(`${LINUX_ENV} spectacle -b -n -o "${screenshotPath}"`);
                    return "Tangkapan layar berhasil diambil dan disimpan di folder Pictures/Screenshots.";
                case 'clipboard':
                    if (level) { // level is reused as the text content for clipboard
                        await systemControl.copyToClipboard(level);
                        return `Teks berhasil disalin ke clipboard: ${level}`;
                    }
                    return "Gagal: Teks untuk clipboard tidak diberikan.";
                default:
                    return "Action tidak valid.";
            }
        } catch (err) {
            return `Gagal mengontrol sistem: ${err.message}`;
        }
    }
};

// Tool definitions for Gemini
export const toolDefinitions = [
    {
        name: "list_files",
        description: "List files and directories in a given path (Sandboxed to home directory)",
        parameters: {
            type: "OBJECT",
            properties: {
                directory: { type: "STRING", description: "The directory path to list" }
            }
        }
    },
    {
        name: "read_file",
        description: "Read the content of a file (Sandboxed to home directory)",
        parameters: {
            type: "OBJECT",
            properties: {
                filePath: { type: "STRING", description: "The path to the file to read" }
            },
            required: ["filePath"]
        }
    },
    {
        name: "write_file",
        description: "Write content to a file. MUST ask for user confirmation via chat FIRST before calling this for non-temporary files.",
        parameters: {
            type: "OBJECT",
            properties: {
                path: { type: "STRING", description: "Absolute path to write to" },
                content: { type: "STRING", description: "Content to write" }
            },
            required: ["path", "content"]
        }
    },
    {
        name: "make_directory",
        description: "Create a new directory (Sandboxed to home directory)",
        parameters: {
            type: "OBJECT",
            properties: {
                directory: { type: "STRING", description: "The directory path to create" }
            },
            required: ["directory"]
        }
    },
    {
        name: "launch_app",
        description: "Launch a Linux application by its binary name (Safeguarded)",
        parameters: {
            type: "OBJECT",
            properties: {
                binaryName: { type: "STRING", description: "The binary name of the app" }
            },
            required: ["binaryName"]
        }
    },
    {
        name: "spotify_control",
        description: "Control Spotify playback (play, pause, next, previous, list).",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", enum: ["play", "pause", "next", "previous", "list"] },
                query: { type: "STRING" }
            },
            required: ["action"]
        }
    },
    {
        name: "get_file_info",
        description: "Get metadata about a file (size, creation date, etc.)",
        parameters: {
            type: "OBJECT",
            properties: {
                filePath: { type: "STRING", description: "Path to the file" }
            },
            required: ["filePath"]
        }
    },
    {
        name: "get_project_context",
        description: "Get summary or detailed information about projects from the knowledge base",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", enum: ["list", "detail"], description: "The action to perform" },
                projectName: { type: "STRING", description: "The project name (required for 'detail')" }
            },
            required: ["action"]
        }
    },
    {
        name: "system_control",
        description: "Control system functions like volume (0-100), brightness (0-100), lock screen, and suspend. Use this tool directly for any hardware control requests.",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", enum: ["volume", "brightness", "lock", "suspend", "screenshot", "clipboard"], description: "The action to perform" },
                level: { type: "STRING", description: "Level (0-100) for volume/brightness, or text content for clipboard. Pass as string." }
            },
            required: ["action"]
        }
    }
];
