import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

const execAsync = promisify(exec);

let lastGlobalAlertTime = 0;
const globalAlerts = new Map(); // Track per-process alerts
const ALERT_COOLDOWN = 1800000; // 30 minutes cooldown for same process/global

export const startResourceWatcher = (sock) => {
    log.system('Starting Proactive Resource Watcher & Healer... 🩺');
    
    const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;

    setInterval(async () => {
        try {
            // 1. Check Global Usage
            const { stdout: memOut } = await execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
            const { stdout: cpuOut } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
            
            const ramUsage = parseFloat(memOut);
            const cpuUsage = parseFloat(cpuOut);

            const now = Date.now();

            // 🚨 Global Critical Alert
            if ((ramUsage > 90 || cpuUsage > 90) && (now - lastGlobalAlertTime > ALERT_COOLDOWN)) {
                await sock.sendMessage(ownerJid, { 
                    text: `🚨 *SYSTEM CRITICAL ALERT*\n\n` +
                          `🧠 *RAM Usage:* ${ramUsage.toFixed(1)}%\n` +
                          `⚡ *CPU Usage:* ${cpuUsage.toFixed(1)}%\n\n` +
                          `Laptop sangat terbebani! Saya akan mencari proses yang mencurigakan...`
                });
                lastGlobalAlertTime = now;
            }

            // 🩺 2. Process Specific Healer (Find resource hogs)
            // Get top 3 processes by memory usage
            const { stdout: psOut } = await execAsync("ps -eo pid,%cpu,%mem,comm --sort=-%mem | head -n 4 | tail -n 3");
            const lines = psOut.trim().split('\n');

            for (const line of lines) {
                const [pid, cpu, mem, name] = line.trim().split(/\s+/);
                const pMem = parseFloat(mem);
                const pCpu = parseFloat(cpu);

                // Threshold: process using > 20% RAM or > 80% CPU
                if (pMem > 20.0 || pCpu > 80.0) {
                    const lastProcessAlert = globalAlerts.get(name) || 0;
                    
                    if (now - lastProcessAlert > ALERT_COOLDOWN) {
                        const reason = pMem > 20.0 ? `RAM tinggi (${pMem}%)` : `CPU tinggi (${pCpu}%)`;
                        
                        const healerMsg = `🩺 *PROACTIVE SYSTEM HEALER*\n\n` +
                                        `⚠️ Terdeteksi aplikasi berat:\n` +
                                        `📌 *Nama:* ${name}\n` +
                                        `🆔 *PID:* ${pid}\n` +
                                        `📊 *Masalah:* ${reason}\n\n` +
                                        `Mau saya matikan aplikasi ini agar laptop kembali stabil?\n` +
                                        `_Balas "Kill ${name}" untuk mengeksekusi._`;

                        await sock.sendMessage(ownerJid, { text: healerMsg });
                        globalAlerts.set(name, now);
                        log.warn(`Healer alert sent for process: ${name}`);
                    }
                }
            }
        } catch (error) {
            log.error('Resource Watcher Error:', error.message);
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
};
