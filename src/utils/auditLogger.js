import fs from 'fs';
import path from 'path';
import { log } from './logger.js';
import { createClient } from '@supabase/supabase-js';
import { settings } from '../config/settings.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);
const AUDIT_LOG_FILE = path.resolve('logs/audit.json');

// Ensure logs directory exists
const logDir = path.dirname(AUDIT_LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

export const auditLogger = {
    /**
     * Log a command execution
     * @param {Object} data { user, command, args, status, error, level }
     */
    logAction: async (data) => {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            user: data.user || 'Unknown',
            command: data.command || 'None',
            args: data.args || [],
            status: data.status || 'success',
            error: data.error || null
        };

        try {
            // 1. Local File Logging (Backup)
            await fs.promises.appendFile(AUDIT_LOG_FILE, JSON.stringify(auditEntry) + '\n');

            // 2. Remote Cloud Logging (Supabase)
            if (supabase) {
                await supabase.from('logs').insert([{
                    event_type: auditEntry.command,
                    level: data.level || (auditEntry.error ? 'error' : 'info'),
                    details: JSON.stringify({
                        user: auditEntry.user,
                        args: auditEntry.args,
                        status: auditEntry.status,
                        error: auditEntry.error
                    })
                }]);
            }
        } catch (err) {
            log.error('Audit Logging failed:', err.message);
        }
    }
};
