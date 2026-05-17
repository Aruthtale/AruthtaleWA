import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const baileys = require('@whiskeysockets/baileys');

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage
} = baileys;

import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import crypto from 'crypto';
import { log } from '../utils/logger.js';
import { handleMessage } from './messageHandler.js';

const SESSION_PATH = path.resolve(process.cwd(), 'session_v2');

// 🗳️ Lite Poll Store (Temporary memory to handle votes)
const pollStore = new Map();

/**
 * Add a poll message to the store so votes can be decrypted later
 * @param {string} remoteJid 
 * @param {string} msgId 
 * @param {object} message 
 */
export const addToPollStore = (remoteJid, msgId, message) => {
    pollStore.set(`${remoteJid}:${msgId}`, message);
    if (pollStore.size > 100) pollStore.delete(pollStore.keys().next().value);
};

let currentSock = null;

// Proxy to dynamically point to the active socket
const sockProxy = new Proxy({}, {
    get: (target, prop) => {
        if (!currentSock) {
            log.warn(`[Proxy] Accessing property '${prop}' but currentSock is null.`);
            return undefined;
        }
        if (prop === '__isProxy') return true;
        if (prop === '__raw') return currentSock;
        
        const val = Reflect.get(currentSock, prop);
        if (typeof val === 'function') {
            return val.bind(currentSock);
        }
        return val;
    },
    set: (target, prop, value) => {
        if (!currentSock) {
            log.warn(`[Proxy] Setting property '${prop}' but currentSock is null.`);
            return false;
        }
        return Reflect.set(currentSock, prop, value);
    }
});

export const connectToWhatsApp = async () => {
    log.info(`Using session directory: ${SESSION_PATH}`);
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    log.wa(`Starting WhatsApp Bot v${version.join('.')}...`);

    const rawSock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Aruthtale', 'Chrome', '1.0.0'],
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
        // Mandatory for Poll Decryption - using our Lite Store
        getMessage: async (key) => {
            return pollStore.get(`${key.remoteJid}:${key.id}`) || undefined;
        }
    });

    currentSock = rawSock;

    rawSock.ev.on('creds.update', saveCreds);

    rawSock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            log.wa('QR Code generated. Silakan scan dengan WhatsApp Anda:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode || lastDisconnect.error?.output?.payload?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            log.error(`🔌 Koneksi terputus: ${lastDisconnect.error?.message || 'Unknown Error'} (Status: ${statusCode})`);
            
            log.wa(`Koneksi terputus (Code: ${statusCode}). Reconnect: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                log.system('🔄 Mencoba menghubungkan kembali dalam 5 detik...');
                // Clean up listeners before reconnecting to prevent memory leaks
                if (rawSock) {
                    rawSock.ev.removeAllListeners();
                    if (rawSock.ws) rawSock.ws.close();
                }
                setTimeout(connectToWhatsApp, 5000);
            } else {
                log.error('❌ Terputus selamanya (Logged Out). Silakan hapus session dan scan ulang.');
            }
        } else if (connection === 'open') {
            log.success('WhatsApp berhasil terhubung!');
        }
    });

    rawSock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                const remoteJid = msg.key.remoteJid;

                // 1. Cache Poll Creation (agar bot ingat isi tombolnya)
                if (msg.message?.pollCreationMessage || msg.message?.pollCreationMessageV2 || msg.message?.pollCreationMessageV3) {
                    pollStore.set(`${remoteJid}:${msg.key.id}`, msg.message);
                    if (pollStore.size > 100) pollStore.delete(pollStore.keys().next().value);
                }

                // 2. Handle Poll Update (Klik Tombol)
                if (msg.message?.pollUpdateMessage) {
                    log.info('📩 Terdeteksi klik tombol (Poll Update)');
                    try {
                        const pollCreationKey = msg.message.pollUpdateMessage.pollCreationMessageKey;
                        const pollMsg = pollStore.get(`${remoteJid}:${pollCreationKey.id}`);
                        
                        if (!pollMsg) {
                            log.warn(`⚠️ Poll asli tidak ditemukan untuk ID: ${pollCreationKey.id}`);
                            continue;
                        }

                        const pollCreation = pollMsg.pollCreationMessage || pollMsg.pollCreationMessageV2 || pollMsg.pollCreationMessageV3;
                        const options = pollCreation.options;

                        log.info(`DEBUG POLL: Options=${JSON.stringify(options)}`);

                        // Re-use Baileys official aggregator with proper context for decryption
                        const votes = getAggregateVotesInPollMessage({
                            message: pollMsg,
                            pollUpdates: [
                                {
                                    key: msg.key,
                                    update: {
                                        pollUpdateMessage: msg.message.pollUpdateMessage
                                    }
                                }
                            ],
                        }, rawSock.user.id);

                        const selectedOption = votes.find(v => v.voters.length > 0);
                        if (selectedOption) {
                            const voteName = selectedOption.name;
                            log.wa(`✅ Tombol terdeteksi: ${voteName}`);
                            
                            let cmdText = '';
                            if (voteName.includes('Next')) cmdText = '!spotify next';
                            else if (voteName.includes('Play/Pause')) cmdText = '!spotify play';
                            else if (voteName.includes('Like')) cmdText = '!spotify like';
                            else if (voteName.includes('Lyrics')) cmdText = '!spotify lirik';

                            if (cmdText) {
                                await handleMessage(sockProxy, { 
                                    key: msg.key, 
                                    message: { conversation: cmdText },
                                    pushName: 'Poll Controller',
                                    skipRateLimit: true
                                });
                            }
                        } else {
                            log.warn('ℹ️ Poll update diterima tapi dekripsi gagal atau tidak ada opsi.');
                        }
                    } catch (err) {
                        log.error('✘ [ERROR] Gagal memproses klik tombol:', err.message);
                    }
                }

                // 2b. Handle List Response (Menu Daftar)
                const listResponse = msg.message?.listResponseMessage || msg.message?.buttonsResponseMessage;
                if (listResponse) {
                    const selectedId = listResponse.singleSelectReply?.selectedRowId || listResponse.selectedButtonId;
                    if (selectedId) {
                        log.wa(`✅ List response detected: ${selectedId}`);
                        await handleMessage(sockProxy, {
                            key: msg.key,
                            message: { conversation: selectedId },
                            pushName: msg.pushName || 'List Controller',
                            skipRateLimit: true
                        });
                        return; // 🛑 Added return to prevent double processing
                    }
                }

                // 3. Regular Command Handling
                if (!msg.key.fromMe) {
                    await handleMessage(sockProxy, msg);
                }
            }
        }
    });

    // Cleanup redundant listener
    rawSock.ev.on('messages.update', () => {});

    return sockProxy;
};
