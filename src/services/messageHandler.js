import { aiProvider } from '../ai/provider.js';
import { memoryService } from './memory.js';
import { settings } from '../config/settings.js';
import { aiCache } from '../services/aiCache.js';
import { securityFilter } from '../utils/security.js';
import { log } from '../utils/logger.js';
import { downloaderService } from '../workers/downloader.js';
import { systemControl } from '../system/systemControl.js';
import { commandQueue } from './commandQueue.js';
import { react } from '../utils/react.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authService } from './authService.js';
import { usageService } from './usageService.js';
import { messageCache } from '../utils/messageCache.js';
import fs from 'fs';

const execAsync = promisify(exec);

const messageQueue = new Map();

// URL detection regex for popular media platforms
const MEDIA_URL_REGEX = /https?:\/\/(www\.)?(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|twitter\.com|x\.com|facebook\.com)\/[^\s]+/i;

export const handleMessage = async (sock, m) => {
    const remoteJid = m.key.remoteJid;
    const msgId = m.key.id;

    // 🛑 Skip messages from self
    if (m.key.fromMe) return;

    if (messageCache.has(msgId)) {
        log.info(`[SKIP] Duplicate message ID: ${msgId}`);
        return;
    }
    messageCache.add(msgId);

    // 🕒 Global Rate Limiter (3s Cooldown) with Memory Cleanup
    if (!global.userCooldowns) global.userCooldowns = new Map();
    
    const realSender = m.key.participant || m.key.remoteJid;
    const senderNumber = realSender.split('@')[0];
    const botNumber = sock.user.id.split(':')[0].split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;

    // 🛑 Skip messages from self (ID check + Number check for multi-device)
    if (m.key.fromMe || senderNumber === botNumber) return;
    
    const lastMsgTime = global.userCooldowns.get(senderNumber) || 0;
    const now = Date.now();
    
    // Cleanup old cooldowns every 100 messages to prevent leak
    if (global.userCooldowns.size > 200) {
        for (const [key, time] of global.userCooldowns.entries()) {
            if (now - time > 60000) global.userCooldowns.delete(key);
        }
    }

    if (!m.skipRateLimit && !isOwner && (now - lastMsgTime < 3000)) {
        log.info(`[RATE-LIMIT] ${senderNumber} is sending too fast.`);
        return;
    }
    if (!m.skipRateLimit) global.userCooldowns.set(senderNumber, now);

    const sender = m.pushName || remoteJid;
    let messageText = m.message?.conversation || 
                       m.message?.extendedTextMessage?.text || 
                       m.message?.imageMessage?.caption ||
                       m.message?.videoMessage?.caption ||
                       m.message?.viewOnceMessage?.message?.imageMessage?.caption ||
                       m.message?.viewOnceMessage?.message?.videoMessage?.caption ||
                       '';
    messageText = messageText.trim();

    // 🎙️ Voice Note Transcription Support
    const isAudio = m.message?.audioMessage;

    if (isAudio) {
        if (!isOwner) {
            return await sock.sendMessage(remoteJid, { text: "⚠️ Fitur pesan suara (Voice-to-Command) hanya tersedia untuk Owner." }, { quoted: m });
        }
        try {
            log.wa(`Detected audio message from Owner. Transcribing...`);
            await react(sock, m, '🎙️');
            
            const { downloadContentFromMessage } = (await import('@whiskeysockets/baileys')).default;
            const stream = await downloadContentFromMessage(m.message.audioMessage, 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Use Gemini for Audio-to-Text
            const transcriptionResult = await aiProvider.chat("Transkripsikan audio ini dengan sangat akurat. Jika ini adalah perintah (misal: 'next lagu', 'screenshot', 'buka aplikasi'), tuliskan perintahnya saja.", {
                audio: {
                    mimeType: "audio/ogg; codecs=opus",
                    data: buffer.toString('base64')
                }
            });

            messageText = transcriptionResult.text.trim();
            log.info(`Transcribed: "${messageText}"`);
            
            // 🚀 Logic:
            const isCommand = messageText.startsWith(settings.prefix);
            if (!isCommand) {
                // VOICE PERSONA: Reply with Voice Note
                await react(sock, m, '🧠');
                const chatResponse = await aiProvider.chat(messageText, { userId: senderNumber });
                
                const { voiceService } = await import('./voiceService.js');
                const voicePath = await voiceService.textToVoice(chatResponse.text);
                
                await sock.sendMessage(remoteJid, { 
                    audio: fs.readFileSync(voicePath), 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                }, { quoted: m });
                
                if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
                return; // End handling here
            } else {
                await react(sock, m, '⚡'); 
                // 🚀 If it's a command from Voice, push to queue and RETURN immediately
                log.wa(`Voice command detected: ${messageText}`);
                m.isCommand = true;
                return await commandQueue.push(sock, m, messageText);
            }
            
        } catch (err) {
            log.error('Voice Persona failed:', err.message);
            return await sock.sendMessage(remoteJid, { text: `❌ Gagal memproses pesan suara: ${err.message}` });
        }
    }

    if (!messageText) return;

    log.wa(`Incoming from ${sender}: "${messageText}"`);

    // 🛡️ Anti-Spam: Length Limit
    if (messageText.length > 2000) {
        log.warn(`Message from ${senderNumber} rejected: Length too long (${messageText.length})`);
        return;
    }

    const isAuthorized = await authService.isAuthorized(senderNumber);

    // 🛑 Token Budget Enforcement (Authorized users only, owner is exempt)
    if (!isOwner && isAuthorized) {
        const overLimitType = await usageService.isOverLimit(senderNumber);
        if (overLimitType) {
            log.warn(`[BUDGET] User ${senderNumber} is over limit: ${overLimitType}`);
            const limitMsg = {
                'AI_TOKENS': '⚠️ *Kuota AI Habis:* Kamu telah mencapai batas harian 50.000 token. Kuota akan di-reset besok pagi.',
                'DOWNLOAD_MB': '⚠️ *Kuota Download Habis:* Kamu telah mencapai batas harian 1GB.',
                'IMAGE_GEN': '⚠️ *Kuota Gambar Habis:* Kamu telah mencapai batas harian 10 gambar.'
            };
            await react(sock, m, '🚫');
            return await sock.sendMessage(remoteJid, { text: limitMsg[overLimitType] || '⚠️ Kuota harian Anda telah habis.' }, { quoted: m });
        }
    }

    const isMyIdCommand = messageText.startsWith(`${settings.prefix}myid`);

    // 🩺 PROACTIVE HEALER HANDLER (Owner Only)
    if (isOwner && messageText.toLowerCase().startsWith('kill ')) {
        const processName = messageText.split(' ')[1];
        if (processName) {
            try {
                await react(sock, m, '⏳');
                await execAsync(`pkill -f ${processName}`);
                await react(sock, m, '✅');
                return await sock.sendMessage(remoteJid, { text: `✅ Berhasil mematikan proses: *${processName}*` }, { quoted: m });
            } catch (error) {
                await react(sock, m, '❌');
                return await sock.sendMessage(remoteJid, { text: `❌ Gagal mematikan *${processName}*: ${error.message}` }, { quoted: m });
            }
        }
    }

    // 1. Check if it's a Command (!command)
    // Strip WhatsApp formatting (*, _, ~) and hidden chars to ensure accurate prefix detection
    const cleanMessageText = messageText.replace(/^[\s*_~\u200B-\u200D\uFEFF]+/, '').trim();
    
    if (cleanMessageText.startsWith(settings.prefix)) {
        return await commandQueue.push(sock, m, cleanMessageText);
    }

    // 2. Check for Media URLs (Auto-Downloader for non-commands)
    const mediaMatch = messageText.match(MEDIA_URL_REGEX);
    if (mediaMatch && (isOwner || isAuthorized)) {
        const url = mediaMatch[0];
        log.wa(`Detected auto-media URL from ${sender}: ${url}`);
        
        let tempDir;
        try {
            await react(sock, m, '⏳');
            await sock.sendMessage(remoteJid, { text: `🎬 *Auto-Batch Download Detected!*\nSedang memproses semua konten, tunggu sebentar...` }, { quoted: m });
            
            const result = await downloaderService.download(url);
            const { files, tempDir: downloadedDir } = result;
            tempDir = downloadedDir;
            
            for (const file of files) {
                const stats = fs.statSync(file.filePath);
                const fileSizeInMB = stats.size / (1024 * 1024);
                const isLarge = fileSizeInMB > 64;

                const mediaOptions = { 
                    caption: `✅ *Item:* ${file.title}\n⏱️ *Duration:* ${file.duration}\n⚖️ *Size:* ${fileSizeInMB.toFixed(1)}MB`,
                };

                if (isLarge) {
                    mediaOptions.document = { url: file.filePath };
                    mediaOptions.mimetype = 'video/mp4';
                    mediaOptions.fileName = `${file.title}.mp4`;
                } else {
                    mediaOptions.video = { url: file.filePath };
                    mediaOptions.mimetype = 'video/mp4';
                    if (file.thumbnailPath && fs.existsSync(file.thumbnailPath)) {
                        mediaOptions.jpegThumbnail = fs.readFileSync(file.thumbnailPath).toString('base64');
                    }
                }

                await sock.sendMessage(remoteJid, mediaOptions);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await react(sock, m, '✅');
            if (result.totalSizeMb) {
                await usageService.logUsage(senderNumber, 'DOWNLOAD_MB', result.totalSizeMb);
            }
        } catch (error) {
            log.error('Auto-downloader error:', error.message);
            
            if (error.message.startsWith('FILE_TOO_LARGE')) {
                const size = error.message.split(':')[1];
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ *File Terlalu Besar:* Estimasi ukuran file adalah *${size}MB*.\n\nDemi keamanan laptop, Aruthtale membatasi download maksimal *200MB*. Silakan download langsung di laptop.` 
                }, { quoted: m });
                await react(sock, m, '❌');
            } else {
                await sock.sendMessage(remoteJid, { text: `❌ *Gagal Mendownload:* ${error.message}\nPastikan link valid dan akun tidak privat.` });
            }
        } finally {
            if (tempDir) downloaderService.cleanup(tempDir);
        }
        return; // 🛑 ALWAYS return here, never let URLs go to AI
    }

    // 3. AI Chat Mode (Authorized Only)
    if (m.isCommand || (!isOwner && !isAuthorized)) {
        return;
    }

    // 🛑 Critical: If the message contains a media URL, we should NOT process it as AI chat
    // even if the downloader failed. This prevents confusing AI "I can't access Instagram" responses.
    if (mediaMatch) {
        log.info(`[SKIP] Message contains media URL, skipping AI chat mode.`);
        return;
    }

    // 🛑 EXTRA SAFETY: Never let commands or things starting with prefix reach AI Chat
    if (cleanMessageText.startsWith(settings.prefix) || cleanMessageText.toLowerCase().includes('!cctv')) {
        log.info(`[SKIP] Re-routed command detected (${cleanMessageText.substring(0, 10)}...), blocking AI chat.`);
        return;
    }

    // 🛑 Special Guard for CCTV to prevent AI interference
    if (cleanMessageText.toLowerCase().includes('cctv') && isOwner) {
        log.info('[SKIP] CCTV keyword detected from Owner, blocking AI to prevent interference.');
        return;
    }

    // Simple Queue to prevent race conditions
    if (messageQueue.has(remoteJid)) {
        log.info('Message added to queue (1 pending)');
        return;
    }

    messageQueue.set(remoteJid, true);

    try {
        log.wa(`Processing AI chat from ${sender}...`);
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI Request Timeout (90s)')), 90000)
        );
        // 🛡️ Prompt Injection Check
        if (securityFilter.isPromptInjection(messageText)) {
            log.warn(`[SECURITY] Potential prompt injection detected from ${remoteJid}`);
            return await sock.sendMessage(remoteJid, { text: "⚠️ *Peringatan Keamanan:* Pesan Anda mengandung pola yang mencurigakan dan telah diblokir." }, { quoted: m });
        }

        const aiTask = (async () => {
            // 🚀 Check Cache First
            const cachedResponse = aiCache.get(messageText, remoteJid);
            if (cachedResponse) {
                await sock.sendPresenceUpdate('composing', remoteJid);
                await new Promise(resolve => setTimeout(resolve, 500));
                await sock.sendMessage(remoteJid, { text: cachedResponse.text });
                return;
            }

            // ⌨️ Send typing indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            const history = await memoryService.getHistory(remoteJid, messageText);
            
            // 🌐 Language detection (Improved)
            const isEnglish = /[a-zA-Z]{4,}/.test(messageText) && !/[aiueo]{2,}/i.test(messageText) && !/ (apa|bisa|yang|ini|itu|ada|ke|di|dari) /i.test(messageText);
            const languageContext = isEnglish ? "Response Language: English. Tone: Professional." : "Bahasa Respon: Indonesia. Gaya: Santai tapi sopan.";

            const currentTime = new Date().toLocaleString('id-ID', { 
                timeZone: 'Asia/Jakarta',
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            const userPersona = global.userPersonas?.get(remoteJid);
            const personaContext = userPersona ? `[USER PERSONA OVERRIDE]: ${userPersona}\n` : '';

            // 🚀 Build context-aware system instruction
            let systemInstruction = '';
            
            if (isOwner) {
                // Full Access Persona for Owner
                systemInstruction = `Identitas: Aruthtale (Asisten Otomasi AI). Lingkungan: EndeavourOS. Database: Supabase. Pencipta: Zennn.\n` +
                                   `KAPABILITAS: Kamu punya akses penuh ke sistem otomasi untuk mendownload media (TikTok/IG/YT), kontrol Spotify, kontrol sistem (volume/brightness/lock/ss), dan manajemen file Linux. Gunakan tool 'system_control' untuk permintaan kontrol hardware.\n` +
                                   `KEAMANAN: Kamu WAJIB meminta izin eksplisit dari Zen sebelum menulis/memodifikasi file sistem (fsTools.write_file).\n` +
                                   `${personaContext}` +
                                   `${languageContext}\n` +
                                   `PENTING: Jika user meminta untuk membuat gambar (image generation), instruksikan user menggunakan perintah *!gen <deskripsi>* secara manual.\n` +
                                   `PENTING: Jika user bertanya tentang kontrol volume atau brightness, gunakan tool 'system_control' daripada menyarankan perintah shell secara manual.\n` +
                                   `PENTING: Jika user bertanya tentang menu atau daftar fitur, KATAKAN: "Tentu! Silakan ketik perintah *!menu* untuk melihat daftar lengkap fitur Aruthtale." (Jangan pernah berkata kamu tidak punya menu).\n` +
                                   `Jika user mengirimkan link, sistem otomasi akan menanganinya secara otomatis. Kamu tidak perlu minta maaf soal "tidak bisa akses link".\n` +
                                   `Gunakan WAKTU SISTEM yang diberikan sebagai acuan tunggal.\n\n` +
                                   `${settings.systemPrompt}`;
            } else {
                // Restricted Persona for Authorized Users
                // Filter out sensitive info from settings.systemPrompt
                const restrictedBasePrompt = settings.systemPrompt
                    .replace(/Lingkungan:.*?\./g, 'Lingkungan: Kamu adalah asisten cloud yang berjalan secara aman.')
                    .replace(/Kontrol Sistem:.*?\)/g, 'Kontrol Sistem: (Terbatas untuk Owner)')
                    .replace(/Developer Tools:.*?\./g, '')
                    .replace(/Clipboard:.*?\./g, '')
                    .replace(/laptop EndeavourOS \(Arch Linux\) milik Zennn dengan desktop KDE Plasma/g, 'server Aruthtale')
                    .replace(/pencipta: Zennn/gi, 'pencipta: Aruthtale Team');

                systemInstruction = `Identitas: Aruthtale (Asisten AI). Status: Cloud Assistant.\n` +
                                   `KAPABILITAS: Kamu membantu user mendownload media, meringkas artikel, dan menjawab pertanyaan. Kamu TIDAK punya akses ke kontrol hardware atau file sistem user.\n` +
                                   `${personaContext}` +
                                   `${languageContext}\n` +
                                   `PENTING: Jika user meminta fitur yang tidak kamu miliki (seperti kontrol volume), katakan bahwa fitur tersebut khusus untuk Owner.\n` +
                                   `PENTING: Jika user bertanya tentang menu atau daftar fitur, KATAKAN: "Silakan ketik *!menu* untuk melihat apa yang bisa saya lakukan."\n` +
                                   `Gunakan WAKTU SISTEM yang diberikan sebagai acuan tunggal.\n\n` +
                                   `${restrictedBasePrompt}`;
            }

            const forcedPrompt = `[WAKTU SISTEM: ${currentTime} WIB]\nUser: ${messageText}`;

            log.ai(`Sending prompt (${isEnglish ? 'EN' : 'ID'})...`);

            let sentMsg = null;
            let lastUpdate = Date.now();

            const result = await aiProvider.chat(forcedPrompt, { 
                systemInstruction: systemInstruction,
                history,
                isOwner: isOwner,
                task: 'AUTO',  // Auto-classify → route to best specialist model
                stream: true,  // Aktifkan streaming
                onChunk: async (fullText) => {
                    // 🧹 Filter tool calls from streaming output
                    const filteredText = fullText
                        .replace(/```json\s*{[\s\S]*?}\s*```/g, '')
                        .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
                        .trim();

                    if (Date.now() - lastUpdate > 2500 && filteredText.length > 5) {
                        lastUpdate = Date.now();
                        try {
                            if (!sentMsg) {
                                sentMsg = await sock.sendMessage(remoteJid, { text: filteredText + '...' }, { quoted: m });
                            } else {
                                await sock.sendMessage(remoteJid, { text: filteredText + '...', edit: sentMsg.key });
                            }
                        } catch (e) {
                            log.warn('Streaming update failed:', e.message);
                        }
                    }
                }
            });
            
            // 📊 Log Usage
            const tokens = result.usage?.totalTokenCount || 0;
            await usageService.logUsage(senderNumber, 'AI_TOKENS', tokens);
            
            // Log which model was used
            if (result.model) {
                log.ai(`[Distributed] Response from: ${result.model}`);
            }

            // 💾 Simpan Response ke Cache & Memori
            aiCache.set(messageText, remoteJid, result);
            await memoryService.save(remoteJid, 'user', messageText);
            await memoryService.save(remoteJid, 'assistant', result.text);
            
            // Final update jika sudah pernah kirim via streaming
            if (sentMsg) {
                await sock.sendMessage(remoteJid, { text: result.text, edit: sentMsg.key });
            }

            return { text: result.text, alreadySent: !!sentMsg };
        })();

        const aiResult = await Promise.race([aiTask, timeoutPromise]);
        
        if (!aiResult.alreadySent) {
            // 🧹 Clean up raw tool calls or empty JSON blocks from final output
            let cleanText = aiResult.text
                .replace(/```json\s*{[\s\S]*?}\s*```/g, '') // Remove JSON blocks
                .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '') // Remove tool call tags
                .trim();

            if (cleanText) {
                await sock.sendMessage(remoteJid, { text: cleanText }, { quoted: m });
            }
        }

    } catch (error) {
        log.error('Queue Processor Error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan: ${error.message}` });
    } finally {
        messageQueue.delete(remoteJid);
    }
};
