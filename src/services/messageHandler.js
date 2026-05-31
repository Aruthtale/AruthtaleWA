import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { commandQueue } from './commandQueue.js';
import { authService } from './authService.js';
import { usageService } from './usageService.js';
import { messageCache } from '../utils/messageCache.js';
import { aiHandler } from './aiHandler.js';
import { autoDownloader } from './autoDownloader.js';
import { voiceHandler } from './voiceHandler.js';
import fs from 'fs';

const messageQueue = new Map();
const MEDIA_URL_REGEX = /https?:\/\/(www\.)?(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|twitter\.com|x\.com|facebook\.com)\/[^\s]+/i;

export const handleMessage = async (sock, m) => {
    const remoteJid = m.key.remoteJid;
    const msgId = m.key.id;

    if (m.key.fromMe) return;
    if (messageCache.has(msgId)) return;
    messageCache.add(msgId);

    const realSender = m.key.participant || m.key.remoteJid;
    const senderNumber = realSender.split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;

    let messageText = (m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '').trim();

    // 🎙️ Voice
    if (m.message?.audioMessage) {
        return await voiceHandler.handle(sock, m, remoteJid, senderNumber, isOwner);
    }

    if (!messageText) return;

    // 🛑 Rate Limiter (shortened for brevity)
    if (!global.userCooldowns) global.userCooldowns = new Map();
    const lastMsgTime = global.userCooldowns.get(senderNumber) || 0;
    if (!m.skipRateLimit && !isOwner && (Date.now() - lastMsgTime < 3000)) return;
    if (!m.skipRateLimit) global.userCooldowns.set(senderNumber, Date.now());

    const isAuthorized = await authService.isAuthorized(senderNumber);

    // Media
    const mediaMatch = messageText.match(MEDIA_URL_REGEX);

    // Command processing
    if (messageText.startsWith(settings.prefix)) {
        log.info(`[DEBUG] Command detected: "${messageText}"`);
        global.lastCommandProcessed = Date.now(); // Set safety flag
        await commandQueue.push(sock, m, messageText);
        return; // ALWAYS return here
    }

    if (mediaMatch && (isOwner || isAuthorized)) {
        log.info(`[DEBUG] Media detected: "${mediaMatch[0]}"`);
        global.lastCommandProcessed = Date.now(); // Set safety flag
        await autoDownloader.handle(sock, m, remoteJid, mediaMatch[0], senderNumber);
        return; // ALWAYS return here
    }

    // AI Chat
    if (isOwner || isAuthorized) {
        // Paranoid check: ensure at least 5 seconds since last command
        const timeSinceLastCommand = Date.now() - (global.lastCommandProcessed || 0);
        if (timeSinceLastCommand < 5000) {
            log.info(`[DEBUG] AI check skipped: Too close to last command (${timeSinceLastCommand}ms)`);
            return;
        }
        
        log.info(`[DEBUG] AI check: text="${messageText}", startsWithPrefix=${messageText.startsWith(settings.prefix)}, mediaMatch=${!!mediaMatch}`);
        const isGroup = remoteJid.endsWith('@g.us');
        const botName = settings.botName.toLowerCase();
        const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMentioned = mentionedJids.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');
        const calledByName = messageText.toLowerCase().includes(botName);

        // Logic: Only reply if mentioned or called by name (Both Private and Group).
        if (isMentioned || calledByName) {
            log.info(`[DEBUG] AI triggered: isMentioned=${isMentioned}, calledByName=${calledByName}`);
            const { memoryService } = await import('./memory.js');
            const history = await memoryService.getHistory(remoteJid, messageText);
            return await aiHandler.processChat(sock, m, senderNumber, messageText, isOwner, isAuthorized, history);
        }
    }
};
