import fs from 'fs';
import { aiProvider } from '../ai/provider.js';
import { log } from '../utils/logger.js';
import { react } from '../utils/react.js';
import { commandQueue } from './commandQueue.js';
import { settings } from '../config/settings.js';

export const voiceHandler = {
    handle: async (sock, m, remoteJid, senderNumber, isOwner) => {
        if (!isOwner) {
            return await sock.sendMessage(remoteJid, { text: "⚠️ Fitur pesan suara hanya untuk Owner." }, { quoted: m });
        }
        try {
            log.wa(`Transcribing audio message...`);
            await react(sock, m, '🎙️');
            
            const { downloadContentFromMessage } = (await import('@whiskeysockets/baileys')).default;
            const stream = await downloadContentFromMessage(m.message.audioMessage, 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const transcription = await aiProvider.chat("Transkripsikan audio ini dengan sangat akurat. Jika ini adalah perintah, tuliskan perintahnya saja.", {
                audio: { mimeType: "audio/ogg; codecs=opus", data: buffer.toString('base64') }
            });

            const messageText = transcription.text.trim();
            log.info(`Transcribed: "${messageText}"`);
            
            if (!messageText.startsWith(settings.prefix)) {
                await react(sock, m, '🧠');
                const chatResponse = await aiProvider.chat(messageText, { userId: senderNumber });
                const { voiceService } = await import('./voiceService.js');
                const voicePath = await voiceService.textToVoice(chatResponse.text);
                await sock.sendMessage(remoteJid, { audio: fs.readFileSync(voicePath), mimetype: 'audio/mp4', ptt: true }, { quoted: m });
                if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
            } else {
                await react(sock, m, '⚡');
                m.isCommand = true;
                return await commandQueue.push(sock, m, messageText);
            }
        } catch (err) {
            log.error('Voice handling failed:', err.message);
            await sock.sendMessage(remoteJid, { text: `❌ Gagal memproses: ${err.message}` });
        }
    }
};
