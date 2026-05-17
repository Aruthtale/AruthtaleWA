import { log } from './logger.js';

/**
 * Send a reaction to a message
 * @param {Object} sock - WhatsApp socket
 * @param {Object} m - WhatsApp message object
 * @param {String} emoji - The emoji to react with
 */
export const react = async (sock, m, emoji) => {
    try {
        if (!sock || !m || !m.key) return;
        
        await sock.sendMessage(m.key.remoteJid, {
            react: {
                text: emoji,
                key: m.key
            }
        });
    } catch (error) {
        log.error('Reaction Error:', error.message);
    }
};

export default react;
