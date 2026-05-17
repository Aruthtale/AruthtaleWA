import { exec } from 'child_process';
import { log } from '../../utils/logger.js';
import { promisify } from 'util';
import { spotifyService } from '../../system/spotify.js';
import { settings } from '../../config/settings.js';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { react } from '../../utils/react.js';
import { launchApp } from '../../utils/system.js';

const execAsync = promisify(exec);

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const action = args[0]?.toLowerCase();

    // Menu Utama
    if (!action) {
        return sock.sendMessage(remoteJid, { 
            text: "🎵 *AruthaBOT Spotify (Enhanced Mode)*\n\n" +
                  "Kontrol Lokal (Linux):\n" +
                  "- !spotify play : Lanjut musik\n" +
                  "- !spotify pause : Jeda musik\n" +
                  "- !spotify next : Lagu selanjutnya\n" +
                  "- !spotify prev : Lagu sebelumnya\n" +
                  "- !spotify status : Cek lagu aktif\n\n" +
                  "Info History (Cloud):\n" +
                  "- !spotify list : Lihat 5 lagu terakhir (Screenshot)\n" +
                  "- !spotify history : Sama dengan list"
        });
    }

    try {
        const env = 'DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000';
        
        // Cek apakah Spotify sedang berjalan
        const { stdout: players } = await execAsync('playerctl -l').catch(() => ({ stdout: '' }));
        const isSpotifyRunning = players.toLowerCase().includes('spotify');

        if (!isSpotifyRunning && ['play', 'pause', 'next', 'prev', 'previous', 'status'].includes(action)) {
            if (action === 'play') {
                await sock.sendMessage(remoteJid, { text: "⏳ *Spotify tidak aktif.* Mencoba membuka Spotify otomatis..." });
                
                // Use robust launch utility
                const { success } = await launchApp('spotify');
                
                if (!success) {
                    log.error('Failed to launch Spotify even with multiple strategies.');
                }
                
                // Tunggu 6 detik agar Spotify siap (sedikit lebih lama untuk Arch/Heavy load)
                await new Promise(resolve => setTimeout(resolve, 6000));
                
                // Cek lagi
                const { stdout: playersAfter } = await execAsync('playerctl -l').catch(() => ({ stdout: '' }));
                if (!playersAfter.toLowerCase().includes('spotify')) {
                    return sock.sendMessage(remoteJid, { text: "❌ *Gagal membuka Spotify.* Silakan buka aplikasi secara manual di laptop." });
                }
            } else {
                return sock.sendMessage(remoteJid, { 
                    text: "❌ *Spotify tidak terdeteksi aktif.*\nPastikan aplikasi Spotify sudah dibuka di laptop." 
                });
            }
        }

        switch (action) {
            case 'play':
                await execAsync(`${env} playerctl -p spotify play`);
                await sock.sendMessage(remoteJid, { text: "▶️ Melanjutkan pemutaran Spotify." });
                break;

            case 'pause':
                await execAsync(`${env} playerctl -p spotify pause`);
                await sock.sendMessage(remoteJid, { text: "⏸️ Musik dijeda." });
                break;

            case 'next':
                await execAsync(`${env} playerctl -p spotify next`);
                await sock.sendMessage(remoteJid, { text: "⏭️ Lagu berikutnya." });
                break;

            case 'prev':
            case 'previous':
                await execAsync(`${env} playerctl -p spotify previous`);
                await sock.sendMessage(remoteJid, { text: "⏮️ Lagu sebelumnya." });
                break;

            case 'status':
            case 'lirik':
            case 'lyrics':
                try {
                    const { stdout: artist } = await execAsync(`${env} playerctl -p spotify metadata artist`);
                    const { stdout: title } = await execAsync(`${env} playerctl -p spotify metadata title`);
                    
                    if (action === 'status') {
                        return await sock.sendMessage(remoteJid, { 
                            text: `🎧 *Sedang Diputar:*\n\n📌 *Judul:* ${title.trim()}\n👤 *Artis:* ${artist.trim()}` 
                        });
                    }

                    // Handle Lyrics
                    const { getLyrics } = await import('../../utils/lyricsProvider.js');
                    const lyrics = await getLyrics(artist.trim(), title.trim());

                    if (!lyrics) {
                        return await sock.sendMessage(remoteJid, { text: `❌ Lirik tidak ditemukan untuk *${title.trim()}*.` });
                    }

                    await sock.sendMessage(remoteJid, { 
                        text: `📜 *LIRIK LAGU*\n\n🎶 *${title.trim()}*\n👤 *${artist.trim()}*\n\n${lyrics}` 
                    }, { quoted: m });

                } catch (err) {
                    log.error('Spotify Metadata/Lyrics Error:', err.message);
                    await sock.sendMessage(remoteJid, { text: "❌ Spotify tidak terdeteksi aktif." });
                }
                break;

            case 'menu':
            case 'control':
                try {
                    const { stdout: title } = await execAsync(`${env} playerctl -p spotify metadata title`).catch(() => ({ stdout: 'Tidak ada lagu' }));
                    
                    const sections = [
                        {
                            title: 'Spotify Playback Control',
                            rows: [
                                { title: '⏭️ Next Track', rowId: '!spotify next', description: 'Skip to next song' },
                                { title: '⏯️ Play/Pause', rowId: '!spotify play', description: 'Toggle playback' },
                                { title: '❤️ Like Song', rowId: '!spotify like', description: 'Save to Liked Songs' },
                                { title: '📜 Get Lyrics', rowId: '!spotify lirik', description: 'Search lyrics for current song' }
                            ]
                        }
                    ];

                    await sock.sendMessage(remoteJid, {
                        text: `🎵 *Spotify Controller*\nPlaying: _${title.trim()}_`,
                        footer: 'Select an action from the list below',
                        buttonText: 'Control Panel',
                        sections
                    });
                } catch (err) {
                    await sock.sendMessage(remoteJid, { text: "❌ Gagal membuka menu: Spotify tidak aktif." });
                }
                break;

            case 'like':
                try {
                    const { stdout: trackIdRaw } = await execAsync(`${env} playerctl -p spotify metadata mpris:trackid`);
                    const trackId = trackIdRaw.trim().split(':').pop(); // Get 'xxxx' from 'spotify:track:xxxx'

                    if (!trackId || trackId === 'track') {
                        return await sock.sendMessage(remoteJid, { text: "❌ Tidak dapat mendeteksi ID lagu." });
                    }

                    await spotifyService.addToMySavedTracks([trackId]);
                    await sock.sendMessage(remoteJid, { text: "❤️ Berhasil ditambahkan ke *Liked Songs*!" });
                    await react(sock, m, '❤️');
                } catch (err) {
                    log.error('Spotify Like Error:', err.message);
                    await sock.sendMessage(remoteJid, { text: `❌ Gagal menyukai lagu: ${err.message}` });
                }
                break;

            case 'login':
                const authUrl = spotifyService.getAuthUrl();
                await sock.sendMessage(remoteJid, { 
                    text: `🔑 *Spotify Login Required*\n\nSilakan buka link ini untuk login dan otorisasi bot:\n\n${authUrl}\n\nSetelah login, Anda akan diarahkan ke URL 127.0.0.1. Copy kode dari URL tersebut (setelah ?code=) dan kirimkan di sini dengan format: *!spotify callback <kode>*` 
                });
                break;

            case 'callback':
                const code = args[1];
                if (!code) return await sock.sendMessage(remoteJid, { text: "❌ Masukkan kode dari URL callback." });
                try {
                    await spotifyService.setTokensFromCode(code);
                    await sock.sendMessage(remoteJid, { text: "✅ Berhasil login ke Spotify! Fitur Cloud (!like, history) sekarang aktif." });
                } catch (err) {
                    await sock.sendMessage(remoteJid, { text: `❌ Login gagal: ${err.message}` });
                }
                break;

            case 'list':
            case 'history':
                if (!settings.spotifyUserId) {
                    return sock.sendMessage(remoteJid, { text: "❌ Masukkan `SPOTIFY_USER_ID` di file .env terlebih dahulu." });
                }
                
                await sock.sendMessage(remoteJid, { text: "📸 Sedang mengambil screenshot history..." });

                try {
                    log.spotify(`Taking Spotify screenshot for user: ${settings.spotifyUserId}`);
                    const historyUrl = `https://spotify-recently-played-readme.vercel.app/api?user=${settings.spotifyUserId}&count=5&unique=true&rnd=${Date.now()}`;
                    const tempPath = path.join(process.cwd(), 'scratch', `spotify_${Date.now()}.png`);
                    
                    // 1. Take Screenshot using Chromium
                    await execAsync(`chromium --headless --disable-gpu --screenshot="${tempPath}" --window-size=500,450 "${historyUrl}"`);

                    if (fs.existsSync(tempPath)) {
                        // 2. Trim whitespace using sharp
                        const imageBuffer = await sharp(tempPath)
                            .trim() 
                            .toBuffer();

                        // 3. Send to WhatsApp
                        await sock.sendMessage(remoteJid, { 
                            image: imageBuffer,
                            caption: "📜 *Recently Played Tracks*\n(Real-time Screenshot)"
                        });
                    } else {
                        throw new Error("Gagal menyimpan screenshot.");
                    }
                } catch (err) {
                    log.error('Failed to take Spotify screenshot:', err);
                    await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil screenshot: ${err.message}` });
                } finally {
                    // 4. Robust Cleanup
                    const scratchDir = path.join(process.cwd(), 'scratch');
                    if (fs.existsSync(scratchDir)) {
                        const files = fs.readdirSync(scratchDir);
                        for (const file of files) {
                            if (file.startsWith('spotify_') && file.endsWith('.png')) {
                                fs.unlinkSync(path.join(scratchDir, file));
                            }
                        }
                    }
                }
                break;

            default:
                await sock.sendMessage(remoteJid, { text: "❌ Perintah tidak dikenal." });
        }
    } catch (error) {
        log.error(`Spotify Command Error: ${error.message}`, error);
        await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan: ${error.message}` });
    }
};
