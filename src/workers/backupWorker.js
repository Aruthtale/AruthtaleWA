import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../utils/logger.js';

const execAsync = promisify(exec);
const BACKUP_DIR = path.resolve('temp/backups');

export const backupService = {
    /**
     * Create a compressed backup of essential data
     */
    createBackup: async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `aruthtale_backup_${timestamp}.tar.gz`;
        const filePath = path.join(BACKUP_DIR, fileName);

        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        log.system('Initiating system backup...');

        try {
            // Compress logs, session, and .env
            // We use tar because it's native to Linux and very efficient
            const command = `tar -czf "${filePath}" logs/ session_v2/ .env docs/information.md config/credentials/cookies.txt 2>/dev/null`;
            await execAsync(command);

            log.success(`Backup created: ${fileName}`);
            
            // Cleanup old backups (keep only last 7 days)
            await backupService.cleanupOldBackups();

            return { fileName, filePath };
        } catch (error) {
            log.error('Backup failed:', error.message);
            throw error;
        }
    },

    cleanupOldBackups: async () => {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        files.forEach(file => {
            const filePath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                log.info(`Deleted old backup: ${file}`);
            }
        });
    },

    /**
     * Schedule daily backup
     */
    init: () => {
        // Run every 24 hours
        setInterval(() => {
            backupService.createBackup().catch(() => {});
        }, 86400000);
        
        log.system('Daily Backup Worker initialized.');
    }
};
