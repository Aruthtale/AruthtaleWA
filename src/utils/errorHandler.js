import { log } from './logger.js';
import { settings } from '../config/settings.js';

export const errorHandler = {
    /**
     * Standard error handling with self-healing capabilities
     */
    handle: async (error, context = 'Global', sock = null, remoteJid = null) => {
        const message = error.message || 'Unknown Error';
        log.error(`[${context}] Error:`, message);

        const isCritical = 
            message.includes('429') || 
            message.includes('quota') || 
            message.includes('invalid_grant') ||
            message.includes('fetch failed') ||
            context === 'System';

        // --- SELF-HEALING LOGIC ---
        if (message.includes('invalid_grant') || message.includes('No access, refresh token')) {
            if (sock && remoteJid) {
                await sock.sendMessage(remoteJid, {
                    text: '⚠️ *Google Auth Error:* Sesi Google telah berakhir. Mohon jalankan `!google login` kembali.'
                });
            }
        }

        // --- OWNER NOTIFICATION ---
        if (sock && isCritical && settings.ownerNumber) {
            try {
                const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;
                const alertEmoji = message.includes('429') ? '⏳' : '🚨';
                await sock.sendMessage(ownerJid, {
                    text: `${alertEmoji} *CRITICAL ALERT* [${context}]\n\n*Error:* ${message}\n*Time:* ${new Date().toLocaleString()}`
                });
            } catch (notifyErr) {
                log.error('Failed to notify owner:', notifyErr.message);
            }
        }
    }
};

export default errorHandler;
