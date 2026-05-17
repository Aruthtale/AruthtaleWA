import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

// Folder yang akan dibersihkan
const TEMP_DIRS = ['temp', 'scratch', 'temp/downloads'];

export const cleanupService = {
    init: () => {
        log.system('Initializing Aggressive Auto-Cleanup Service (2-Hour Cycle)...');
        
        // Jalankan pembersihan pertama kali saat startup
        cleanupService.run();

        // Jadwalkan pembersihan setiap 1 jam
        setInterval(() => {
            cleanupService.run();
        }, 60 * 60 * 1000); 
    },

    run: () => {
        log.automation('Running hourly maintenance & cleanup...');
        
        let deletedCount = 0;
        const now = Date.now();
        const MAX_AGE = 2 * 60 * 60 * 1000; // File lebih dari 2 jam akan dihapus

        TEMP_DIRS.forEach(dirName => {
            const dirPath = path.resolve(dirName);
            
            if (fs.existsSync(dirPath)) {
                try {
                    const files = fs.readdirSync(dirPath);
                    
                    files.forEach(file => {
                        if (file === '.gitignore' || file === 'spotify_tokens.json') return;

                        const filePath = path.join(dirPath, file);
                        const stats = fs.statSync(filePath);

                        if (now - stats.mtimeMs > MAX_AGE) {
                            if (stats.isDirectory()) {
                                fs.rmSync(filePath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(filePath);
                            }
                            deletedCount++;
                        }
                    });
                } catch (err) {
                    log.error(`Cleanup failed for ${dirName}:`, err.message);
                }
            }
        });

        // Audit Log Rotation (Prevent file bloating)
        const auditLogPath = path.resolve('logs/audit.json');
        if (fs.existsSync(auditLogPath)) {
            const stats = fs.statSync(auditLogPath);
            if (stats.size > 5 * 1024 * 1024) { // Jika lebih dari 5MB
                fs.writeFileSync(auditLogPath, ''); // Reset audit file
                log.success('Audit log rotated (exceeded 5MB).');
            }
        }

        if (deletedCount > 0) {
            log.success(`Cleanup complete. Deleted ${deletedCount} files older than 2 hours.`);
        } else {
            log.automation('Cleanup complete. No expired files found.');
        }
    }
};
