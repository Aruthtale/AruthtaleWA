import { log } from '../utils/logger.js';
import { routeCommand } from './commandRouter.js';

class CommandQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.delayBetweenCommands = 2000; // 2 seconds to be safe
        this.maxQueueSize = 10; // Max 10 commands in queue
    }

    /**
     * Push a new command task to the queue
     * @param {Object} sock - WhatsApp socket
     * @param {Object} m - WhatsApp message object
     * @param {String} text - Full command text
     */
    async push(sock, m, text) {
        if (this.queue.length >= this.maxQueueSize) {
            log.warn(`[QUEUE] Rejected: Queue is full (${this.maxQueueSize})`);
            const remoteJid = m.key.remoteJid;
            await sock.sendMessage(remoteJid, { 
                text: `❌ *Antrian Penuh*\nBot sedang sangat sibuk. Mohon coba lagi beberapa saat lagi.` 
            }, { quoted: m });
            return;
        }

        if (this.isProcessing) {
            const position = this.queue.length + 1;
            const remoteJid = m.key.remoteJid;
            await sock.sendMessage(remoteJid, { 
                text: `⏳ *Antrian Terdeteksi (Posisi: ${position})*\nBot sedang memproses perintah lain. Mohon tunggu sebentar ya...` 
            }, { quoted: m });
        }

        this.queue.push({ sock, m, text });
        log.info(`[QUEUE] Command added to queue. Size: ${this.queue.length}`);
        
        if (!this.isProcessing) {
            this.process();
        }
    }

    /**
     * Process the queue sequentially
     */
    async process() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        try {
            log.info(`[QUEUE] Processing task...`);
            
            // Timeout wrapper for command execution
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('COMMAND_TIMEOUT')), 600000)
            );

            await Promise.race([
                routeCommand(task.sock, task.m, task.text),
                timeoutPromise
            ]);
            
        } catch (error) {
            if (error.message === 'COMMAND_TIMEOUT') {
                log.error(`[QUEUE] Command timed out after 120s:`, task.text);
                const remoteJid = task.m.key.remoteJid;
                await task.sock.sendMessage(remoteJid, { 
                    text: `❌ *Waktu Habis (Timeout)*\nPerintah Anda memakan waktu terlalu lama dan telah dibatalkan otomatis.` 
                }, { quoted: task.m });
            } else {
                log.error(`[QUEUE] Error processing task:`, error.message);
            }
        } finally {
            // Wait for a bit before processing next command
            setTimeout(() => this.process(), this.delayBetweenCommands);
        }
    }
}

export const commandQueue = new CommandQueue();
export default commandQueue;
