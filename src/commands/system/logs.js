import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../../utils/logger.js';

const execPromise = promisify(exec);

export const logs = {
    name: 'logs',
    description: 'Menampilkan log sistem terakhir dari bot (Owner Only)',
    category: 'system',
    adminOnly: true,
    ownerOnly: true,
    
    execute: async (sock, msg, args) => {
        const remoteJid = msg.key.remoteJid;
        const lineCount = args[0] || 15;

        try {
            log.system(`Fetching last ${lineCount} logs...`);
            
            // Perintah untuk mengambil log dari systemd
            const { stdout, stderr } = await execPromise(`journalctl -u ai-wa-bot.service -n ${lineCount} --no-pager`);
            
            if (stderr && !stdout) {
                throw new Error(stderr);
            }

            const cleanLogs = stdout || 'Tidak ada log ditemukan.';
            
            await sock.sendMessage(remoteJid, {
                text: `📜 *BOT SYSTEM LOGS (Last ${lineCount} lines)*\n\n\`\`\`${cleanLogs}\`\`\``
            });

        } catch (error) {
            log.error('Failed to fetch logs:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ *Gagal mengambil log:* ${error.message}\nPastikan bot berjalan sebagai systemd service.`
            });
        }
    }
};

export default logs;
