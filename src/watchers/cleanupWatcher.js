import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const FILE_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours
const TARGET_DIRS = ['temp/downloads', 'temp'];

/**
 * Periodically cleans up old temporary files
 */
export const startCleanupWatcher = () => {
    log.system('♻️ Cleanup Watcher started (Interval: 1h)');

    setInterval(() => {
        TARGET_DIRS.forEach(dir => {
            const fullPath = path.resolve(dir);
            if (!fs.existsSync(fullPath)) return;

            try {
                const files = fs.readdirSync(fullPath);
                const now = Date.now();
                let deletedCount = 0;

                files.forEach(file => {
                    const filePath = path.join(fullPath, file);
                    const stats = fs.statSync(filePath);

                    if (now - stats.mtimeMs > FILE_MAX_AGE) {
                        if (stats.isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                        deletedCount++;
                    }
                });

                if (deletedCount > 0) {
                    log.system(`[Cleanup] Removed ${deletedCount} old files from ${dir}`);
                }
            } catch (error) {
                log.error(`[Cleanup] Failed to clean ${dir}:`, error.message);
            }
        });
    }, CLEANUP_INTERVAL);
};
