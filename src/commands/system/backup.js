import { backupService } from '../../workers/backupWorker.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;

    try {
        await sock.sendMessage(remoteJid, { text: '📦 *Creating system backup...*' }, { quoted: m });
        
        const { fileName } = await backupService.createBackup();
        
        await sock.sendMessage(remoteJid, { 
            text: `✅ *Backup Berhasil!*\n\n📄 File: \`${fileName}\`\n📂 Lokasi: \`temp/backups/\`\n\nData sesi, log, dan konfigurasi telah diamankan.` 
        }, { quoted: m });
        
    } catch (error) {
        log.error('Manual backup error:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membuat backup: ${error.message}` });
    }
};
