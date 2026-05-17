import os from 'os';
import { log } from '../utils/logger.js';

const startTime = Date.now();

export const healthService = {
    getStatus: (sock) => {
        const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        return {
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            connection: sock?.ws?.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
            memory: `${memoryUsage} MB`,
            system: {
                load: os.loadavg()[0].toFixed(2),
                freeMem: `${freeMemory} GB / ${totalMemory} GB`,
                platform: os.platform(),
                cpu: os.cpus()[0].model
            }
        };
    },

    /**
     * Get detailed system stats for commands like !status and !doctor
     */
    getSystemStats: async () => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const stats = {
            ram: { used: '0', total: '0', percent: '0' },
            cpu: { load: '0' },
            battery: { percent: '0', status: 'Unknown' }
        };

        try {
            // 1. RAM Stats
            const totalMem = os.totalmem() / (1024 ** 3);
            const freeMem = os.freemem() / (1024 ** 3);
            const usedMem = totalMem - freeMem;
            stats.ram.total = totalMem.toFixed(1);
            stats.ram.used = usedMem.toFixed(1);
            stats.ram.percent = ((usedMem / totalMem) * 100).toFixed(0);

            // 2. CPU Load
            const { stdout: cpuOut } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
            stats.cpu.load = cpuOut.trim().replace(',', '.') || '0';

            // 3. Battery Stats (Linux)
            try {
                const { stdout: battPerc } = await execAsync("cat /sys/class/power_supply/BAT0/capacity").catch(() => ({ stdout: '100' }));
                const { stdout: battStat } = await execAsync("cat /sys/class/power_supply/BAT0/status").catch(() => ({ stdout: 'Full' }));
                stats.battery.percent = battPerc.trim();
                stats.battery.status = battStat.trim();
            } catch {
                stats.battery.percent = '100';
                stats.battery.status = 'AC Power';
            }
        } catch (err) {
            log.error('Error fetching system stats:', err.message);
        }

        return stats;
    },

    initGracefulShutdown: (sock) => {
        const handleShutdown = async (signal) => {
            log.warn(`Received ${signal}. Shutting down gracefully...`);
            
            try {
                if (sock) {
                    await sock.sendMessage(process.env.OWNER_NUMBER, { text: `⚠️ Bot sedang dimatikan (Signal: ${signal}). Sampai jumpa!` });
                    sock.end();
                }
            } catch (err) {
                // Ignore if connection already closed
            }

            log.info('Final cleanup complete. Exiting process.');
            process.exit(0);
        };

        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
};
