import { downloadContentFromMessage } from '@whiskeysockets/baileys';

/**
 * Download media from a WhatsApp message
 */
export const downloadWAMedia = async (message) => {
    let type = Object.keys(message)[0];
    let msg = message[type];

    if (type === 'buttonsMessage') {
        type = Object.keys(msg)[0];
        msg = msg[type];
    }
    if (type === 'viewOnceMessage') {
        type = Object.keys(msg.message)[0];
        msg = msg.message[type];
    }

    const stream = await downloadContentFromMessage(msg, type.replace('Message', ''));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
};
