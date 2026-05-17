import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../utils/logger.js';
import { settings } from '../config/settings.js';

const execAsync = promisify(exec);

// Ambang batas (Thresholds)
const THRESHOLDS = {
    TEMP: 85,       // Celcius (User requested 85)
    BATTERY: 15,    // Persen
    DISK: 90        // Persen
};

let lastAlerts = {
    temp: 0,
    battery: 0,
    disk: 0
};

const ALERT_COOLDOWN = 30 * 60 * 1000; // Kirim ulang alert setiap 30 menit (agar tidak spam)

export const alertService = {
    init: (sock) => {
        log.system('Initializing Proactive Alerting System...');
        
        // Cek berkala setiap 5 menit
        setInterval(() => {
            alertService.checkSystem(sock);
        }, 5 * 60 * 1000);
        
        // Jalankan cek pertama
        alertService.checkSystem(sock);
    },

    checkSystem: async (sock) => {
        if (!sock) return;
        const now = Date.now();

        try {
            // 1. Cek Suhu (Linux Native)
            const { stdout: tempOut } = await execAsync("sensors | grep 'Package id 0:' | awk '{print $4}' | tr -d '+°C'");
            const temp = parseFloat(tempOut);
            if (temp > THRESHOLDS.TEMP && (now - lastAlerts.temp > ALERT_COOLDOWN)) {
                await sock.sendMessage(`${settings.ownerNumber}@s.whatsapp.net`, { 
                    text: `🌡️ *ALERT: SUHU PANAS!*\n\nSuhu CPU kamu mencapai *${temp}°C*. Pertimbangkan untuk menutup aplikasi berat atau cek kipas laptop.` 
                });
                lastAlerts.temp = now;
                log.warn(`Proactive Alert: High CPU Temp (${temp}°C)`);
            }

            // 2. Cek Baterai (Linux Native via upower)
            const { stdout: batOut } = await execAsync("upower -i $(upower -e | grep 'BAT') | grep -E 'percentage|state'");
            const isCharging = batOut.includes('charging') && !batOut.includes('discharging');
            const batMatch = batOut.match(/percentage:\s+(\d+)%/);
            const batLevel = batMatch ? parseInt(batMatch[1]) : 100;

            if (batLevel < THRESHOLDS.BATTERY && !isCharging && (now - lastAlerts.battery > ALERT_COOLDOWN)) {
                await sock.sendMessage(`${settings.ownerNumber}@s.whatsapp.net`, { 
                    text: `🔋 *ALERT: BATERAI KRITIS!*\n\nBaterai tersisa *${batLevel}%* dan tidak sedang di-cas. Segera colokkan charger!` 
                });
                lastAlerts.battery = now;
                log.warn(`Proactive Alert: Low Battery (${batLevel}%)`);
            }

            // 3. Cek Disk Space
            const { stdout: diskOut } = await execAsync("df / --output=pcent | tail -1 | tr -d ' %'");
            const diskUsage = parseInt(diskOut);
            if (diskUsage > THRESHOLDS.DISK && (now - lastAlerts.disk > ALERT_COOLDOWN)) {
                await sock.sendMessage(`${settings.ownerNumber}@s.whatsapp.net`, { 
                    text: `💾 *ALERT: DISK HAMPIR PENUH!*\n\nPenggunaan root disk mencapai *${diskUsage}%*. Segera bersihkan file yang tidak perlu.` 
                });
                lastAlerts.disk = now;
                log.warn(`Proactive Alert: Disk space low (${diskUsage}%)`);
            }

        } catch (error) {
            log.error('Alert Service Error:', error.message);
        }
    }
};
