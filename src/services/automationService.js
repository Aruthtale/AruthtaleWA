import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { aiProvider } from '../ai/provider.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './firebaseService.js';
import { googleService } from './googleService.js';
import { searchService } from './searchService.js';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * automationService
 * Handles scheduled tasks: Daily Briefing and 2-Hourly Summary
 */
export const automationService = {
    init: (sock) => {
        log.system('Initializing Automation Service (Daily Briefing & 2-Hour Summary)... 🚀');
        
        let lastBriefingDate = '';
        let lastSummaryHour = -1;
        let lastJournalDate = '';
        let lastEmailCheck = 0;
        let lastResourceCheck = 0;

        setInterval(async () => {
            try {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();

                // 1. Daily Briefing 2.0: Trigger at 09:00 AM
                if (currentHour === 9 && currentMinute === 0 && lastBriefingDate !== today) {
                    await automationService.sendDailyBriefing(sock);
                    lastBriefingDate = today;
                }

                // 2. 2-Hourly Summary: Trigger every even hour
                if (currentHour % 2 === 0 && currentMinute === 0 && lastSummaryHour !== currentHour) {
                    await automationService.sendTwoHourSummary(sock);
                    lastSummaryHour = currentHour;
                }

                // 3. Nightly Journal Prompt: Trigger at 10:00 PM (22:00)
                if (currentHour === 22 && currentMinute === 0 && lastJournalDate !== today) {
                    await automationService.sendNightlyJournalPrompt(sock);
                    lastJournalDate = today;
                }

                // 4. Gmail Monitor: Check every 5 minutes
                if (now.getTime() - lastEmailCheck > 5 * 60 * 1000) {
                    automationService.checkEmails(sock).catch(e => log.error('Interval checkEmails Error:', e.message));
                    lastEmailCheck = now.getTime();
                }

                // 5. Resource Monitor: Check every 10 minutes
                if (now.getTime() - lastResourceCheck > 10 * 60 * 1000) {
                    automationService.checkResources(sock).catch(e => log.error('Interval checkResources Error:', e.message));
                    lastResourceCheck = now.getTime();
                }
            } catch (err) {
                log.error('Automation Scheduler Error:', err.message);
            }
        }, 60000);

        // Run initial checks immediately after boot
        setTimeout(() => {
            automationService.checkEmails(sock).catch(e => log.error('Initial checkEmails Error:', e.message));
            automationService.checkResources(sock).catch(e => log.error('Initial checkResources Error:', e.message));
            lastEmailCheck = Date.now();
            lastResourceCheck = Date.now();
        }, 5000);
    },

    /**
     * Send Nightly Journal Prompt to Owner
     */
    sendNightlyJournalPrompt: async (sock) => {
        const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;
        log.info('Sending Nightly Journal Prompt...');
        try {
            const prompt = "Berikan sapaan malam yang hangat dan ajak Zen untuk melakukan journaling singkat tentang harinya (pencapaian, perasaan, atau hal menarik). Gunakan gaya bahasa Aruthtale yang perhatian.";
            const greeting = await aiProvider.chat(prompt);
            
            await sock.sendMessage(ownerJid, { 
                text: `🌙 *NIGHTLY REFLECTION*\n\n${greeting.text}\n\n_Balas pesan ini untuk mencatat jurnal harimu._` 
            });
        } catch (err) {
            log.error('sendNightlyJournalPrompt Error:', err.message);
        }
    },

    /**
     * Send Morning Briefing 2.0 to Owner
     */
    sendDailyBriefing: async (sock) => {
        const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;
        log.info('Preparing Smart Morning Briefing 2.0...');

        try {
            // A. Fetch Weather
            let weather = 'Info cuaca tidak tersedia.';
            try {
                const { stdout: weatherOut } = await execAsync('curl -s "wttr.in/Jakarta?format=%C+%t"');
                if (weatherOut) weather = weatherOut.trim();
            } catch (e) { log.warn('Weather fetch failed'); }
            
            // B. Fetch News (News Summary 2.0)
            let newsContext = 'Tidak ada berita terbaru hari ini.';
            try {
                const newsResults = await searchService.search("berita teknologi terbaru gadget arch linux indonesia");
                if (newsResults.length > 0) {
                    newsContext = newsResults.map(n => `- ${n.title} (${n.link})`).join('\n');
                }
            } catch (e) { log.warn('News fetch failed'); }

            // C. Fetch Schedule (Local & Google)
            let scheduleList = '';
            try {
                const startOfDay = new Date();
                startOfDay.setHours(0,0,0,0);
                const endOfDay = new Date();
                endOfDay.setHours(23,59,59,999);

                const snapshot = await db.collection('reminders')
                    .where('scheduled_time', '>=', startOfDay.toISOString())
                    .where('scheduled_time', '<=', endOfDay.toISOString())
                    .get();

                const reminders = snapshot.docs.map(doc => doc.data());

                const localReminders = reminders?.map(r => `• [Local] ${r.message}`).join('\n') || '';
                
                let googleData = '';
                const gTasks = await googleService.listTasks();
                const gEvents = await googleService.listEventsToday();

                if (gTasks && gTasks.length > 0) {
                    googleData += `\n- Google Tasks:\n${gTasks.map(t => `  • ${t.title}`).join('\n')}`;
                }
                if (gEvents && gEvents.length > 0) {
                    googleData += `\n- Google Calendar:\n${gEvents.map(e => `  • [${new Date(e.start.dateTime || e.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}] ${e.summary}`).join('\n')}`;
                }
                
                scheduleList = (localReminders + googleData).trim() || 'Tidak ada jadwal penting hari ini.';
            } catch (e) { log.warn('Schedule fetch failed'); }

            // D. AI Orchestration
            const prompt = `Buatlah laporan "SMART MORNING BRIEFING 2.0" untuk Zen.\n\n` +
                          `KONTEKS HARI INI:\n` +
                          `📍 Cuaca: ${weather}\n` +
                          `📅 Jadwal:\n${scheduleList}\n` +
                          `📰 Berita Terbaru:\n${newsContext}\n\n` +
                          `INSTRUKSI:\n` +
                          `1. Mulai dengan greeting yang sangat bersemangat.\n` +
                          `2. Ringkas berita terbaru (pilih 3 paling menarik) dengan gaya bahasa asisten AI yang cerdas.\n` +
                          `3. Berikan "Productivity Tip of the Day" singkat.\n` +
                          `4. Gunakan gaya bahasa Aruthtale (Bahasa Indonesia, teknis tapi ramah).`;

            const briefing = await aiProvider.chat(prompt, {
                systemInstruction: "Kamu adalah Aruthtale. Berikan ringkasan pagi yang cerdas, mencakup berita teknologi dan jadwal Zen."
            });

            await sock.sendMessage(ownerJid, { 
                text: `🌅 *SMART MORNING BRIEFING 2.0*\n\n${briefing.text}` 
            });
            log.success('Morning Briefing 2.0 sent.');

        } catch (err) {
            log.error('sendDailyBriefing Error:', err.message);
        }
    },

    /**
     * Send Status Summary & Chat Summary to Owner every 2 hours
     */
    sendTwoHourSummary: async (sock) => {
        const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;
        log.info('Preparing 2-Hourly Summary Report...');

        try {
            const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
            const { stdout: mem } = await execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
            
            let gpu = "N/A";
            try {
                const { stdout: gpuOut } = await execAsync("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits");
                gpu = `${gpuOut.trim()}%`;
            } catch (e) {}

            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const snapshot = await db.collection('memories')
                .where('created_at', '>=', twoHoursAgo)
                .orderBy('created_at', 'asc')
                .get();
            
            const chats = snapshot.docs.map(doc => doc.data());

            let summaryContent = "Tidak ada aktivitas percakapan dalam 2 jam terakhir.";
            
            if (chats && chats.length > 0) {
                const significantChats = chats.filter(c => c.content && c.content.length > 5);
                if (significantChats.length > 0) {
                    const chatLog = significantChats.map(c => `[${c.role}]: ${c.content}`).join('\n');
                    const summaryPrompt = `Ringkas log chat 2 jam terakhir menjadi 3 poin eksekutif:\n\n${chatLog}`;
                    const result = await aiProvider.chat(summaryPrompt, {
                        systemInstruction: "Berikan ringkasan aktivitas chat yang padat."
                    });
                    summaryContent = result.text;
                }
            }

            const reportMsg = `📊 *2-HOURLY AUTOMATION REPORT*\n\n` +
                             `🖥️ *Resource Status:*\n` +
                             `• CPU: ${parseFloat(cpu).toFixed(1)}%\n` +
                             `• RAM: ${parseFloat(mem).toFixed(1)}%\n` +
                             `• GPU: ${gpu}\n\n` +
                             `💬 *Chat Activities:*\n` +
                             `${summaryContent}\n\n` +
                             `_Laporan otomatis Aruthtale._`;

            await sock.sendMessage(ownerJid, { text: reportMsg });
            log.success('2-Hourly Summary Report sent.');

        } catch (err) {
            log.error('sendTwoHourSummary Error:', err.message);
        }
    },

    /**
     * Check for new unread emails and notify owner
     */
    checkEmails: async (sock) => {
        if (!sock) return;
        
        // Dynamic JID detection (handles traditional numbers and new LID format)
        const ownerNumber = settings.ownerNumber;
        const ownerJid = ownerNumber.includes('@') ? ownerNumber : 
                        (ownerNumber.length > 13 ? `${ownerNumber}@lid` : `${ownerNumber}@s.whatsapp.net`);
        
        const STATUS_PATH = path.join(process.cwd(), 'src/data/email_status.json');

        try {
            log.system(`Checking emails for owner: ${ownerJid}`);
            const emails = await googleService.listEmails(10);
            
            if (!emails) {
                log.warn('Gmail API returned null (No token?)');
                return;
            }

            if (emails.length === 0) {
                log.info('No unread emails found.');
                return;
            }

            log.info(`Found ${emails.length} unread emails. Latest ID: ${emails[0].id}`);

            // Load last notified ID
            let status = { lastNotifiedId: null };
            try {
                const data = await fs.readFile(STATUS_PATH, 'utf8');
                status = JSON.parse(data);
            } catch (e) {
                log.warn('Could not read email_status.json, starting fresh');
            }

            const latestEmail = emails[0];
            log.info(`Comparing: Latest[${latestEmail.id}] vs Last[${status.lastNotifiedId}]`);
            
            if (latestEmail.id !== status.lastNotifiedId) {
                log.success(`New Email Detected! Sending notification: ${latestEmail.subject}`);
                
                const emailMsg = `📧 *NEW EMAIL NOTIFICATION*\n\n` +
                                `👤 *From:* ${latestEmail.from}\n` +
                                `📌 *Subject:* ${latestEmail.subject}\n` +
                                `🕒 *Date:* ${latestEmail.date}\n\n` +
                                `📝 *Snippet:* ${latestEmail.snippet}...\n\n` +
                                `_Balas !google untuk manajemen lainnya._`;

                await sock.sendMessage(ownerJid, { text: emailMsg });
                
                // Update last notified ID
                status.lastNotifiedId = latestEmail.id;
                await fs.writeFile(STATUS_PATH, JSON.stringify(status, null, 4));
            } else {
                log.info('No new unread emails since last check.');
            }
        } catch (err) {
            log.error('checkEmails Critical Error:', err.message);
            if (err.message && err.message.includes('invalid_grant')) {
                log.warn('Google OAuth Token is invalid or expired. Removing token.json to prevent further errors.');
                const TOKEN_PATH = path.join(process.cwd(), 'config/credentials/token.json');
                fs.unlink(TOKEN_PATH).catch(e => log.error('Failed to remove token.json:', e.message));
                
                sock.sendMessage(ownerJid, { 
                    text: `⚠️ *GOOGLE INTEGRATION ALERT*\n\nSesi login Google Anda telah kedaluwarsa atau tidak valid (invalid_grant). Fitur otomatis dijeda.\n\nSilakan login kembali dengan mengetik:\n*!google login*` 
                }).catch(e => log.error('Failed to send notification:', e.message));
            }
        }
    },

    /**
     * Check system resources and alert if thresholds are exceeded
     */
    checkResources: async (sock) => {
        if (!sock) return;

        const ownerNumber = settings.ownerNumber;
        const ownerJid = ownerNumber.includes('@') ? ownerNumber : 
                        (ownerNumber.length > 13 ? `${ownerNumber}@lid` : `${ownerNumber}@s.whatsapp.net`);

        try {
            log.system('Monitoring system resources...');
            
            // 1. CPU Usage
            const { stdout: cpuRaw } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
            const cpu = parseFloat(cpuRaw);

            // 2. RAM Usage
            const { stdout: memRaw } = await execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
            const mem = parseFloat(memRaw);

            // 3. GPU Usage & Temp (NVIDIA)
            let gpu = 0;
            let gpuTemp = 0;
            let hasGpu = false;

            try {
                const { stdout: gpuOut } = await execAsync("nvidia-smi --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits");
                const [usage, temp] = gpuOut.trim().split(',').map(v => parseFloat(v));
                gpu = usage;
                gpuTemp = temp;
                hasGpu = true;
            } catch (e) {
                // No GPU or nvidia-smi failed
            }

            // --- ALERT LOGIC ---
            let alerts = [];

            if (cpu >= settings.cpuThreshold) {
                alerts.push(`⚠️ *High CPU Usage:* ${cpu.toFixed(1)}% (Threshold: ${settings.cpuThreshold}%)`);
            }

            if (mem >= settings.ramThreshold) {
                alerts.push(`⚠️ *High RAM Usage:* ${mem.toFixed(1)}% (Threshold: ${settings.ramThreshold}%)`);
            }

            if (hasGpu) {
                if (gpu >= settings.gpuThreshold) {
                    alerts.push(`🔥 *High GPU Usage:* ${gpu}% (Threshold: ${settings.gpuThreshold}%)`);
                }
                if (gpuTemp >= settings.gpuTempThreshold) {
                    alerts.push(`🌡️ *High GPU Temp:* ${gpuTemp}°C (Threshold: ${settings.gpuTempThreshold}°C)`);
                }
            }

            if (alerts.length > 0) {
                log.warn(`Resource Alert triggered: ${alerts.join(', ')}`);
                const alertMsg = `🚨 *SYSTEM RESOURCE ALERT*\n\n` +
                                alerts.join('\n') + `\n\n` +
                                `_Gunakan !sys untuk melihat detail lengkap atau !kill <process_name> jika perlu._`;

                await sock.sendMessage(ownerJid, { text: alertMsg });
            } else {
                log.info('System resources are within healthy limits.');
            }

        } catch (err) {
            log.error('checkResources Error:', err.message);
        }
    }
};
