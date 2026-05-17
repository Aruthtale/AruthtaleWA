import fs from 'fs';
import path from 'path';
import { log } from '../../utils/logger.js';

const AUDIT_LOG_FILE = path.resolve('logs/audit.json');

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;

    try {
        if (!fs.existsSync(AUDIT_LOG_FILE)) {
            return await sock.sendMessage(remoteJid, { text: '📭 Belum ada catatan aktivitas (Audit Log kosong).' }, { quoted: m });
        }

        const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').trim().split('\n');
        
        // Take last 5 entries
        const lastEntries = data.slice(-5).reverse();
        
        let report = `🕵️‍♂️ *AUDIT LOG (5 Aktivitas Terakhir)*\n\n`;
        
        lastEntries.forEach((line, index) => {
            const entry = JSON.parse(line);
            const time = new Date(entry.timestamp).toLocaleTimeString('id-ID');
            const statusIcon = entry.status === 'success' ? '✅' : '❌';
            
            report += `${index + 1}. [${time}] ${statusIcon} *!${entry.command}*\n`;
            report += `   👤 User: ${entry.user.split('@')[0]}\n`;
            if (entry.error) report += `   ⚠️ Error: ${entry.error}\n`;
            report += `\n`;
        });

        report += `_Gunakan *!debug* untuk log sistem lengkap._`;

        await sock.sendMessage(remoteJid, { text: report }, { quoted: m });
    } catch (error) {
        log.error('Failed to read audit log:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membaca audit log: ${error.message}` });
    }
};
