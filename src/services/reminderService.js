import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { aiProvider } from '../ai/provider.js';
import { db, insert } from './firebaseService.js';

export const reminderService = {
    /**
     * Parse reminder intent using AI
     */
    parseReminder: async (rawText) => {
        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const prompt = `Sekarang waktu sistem adalah: ${now}.\n` +
                       `User ingin diingatkan: "${rawText}".\n` +
                       `Ekstrak waktu dan pesan pengingat tersebut.\n` +
                       `Balas HANYA dengan format JSON: {"time": "YYYY-MM-DD HH:MM:00", "message": "isi pengingat"}.\n` +
                       `Gunakan format waktu 24 jam. Jika tidak ada tanggal, asumsikan hari ini.`;
        
        try {
            const response = await aiProvider.chat(prompt, { 
                systemInstruction: "Kamu adalah parser waktu yang sangat akurat. Keluarkan JSON murni tanpa markdown." 
            });
            const cleanJson = response.text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            log.error('Reminder parse error:', error.message);
            throw new Error('Gagal memahami waktu pengingat. Gunakan format yang lebih jelas.');
        }
    },

    /**
     * Save reminder to Firestore
     */
    saveReminder: async (data) => {
        const { error } = await insert('reminders', {
            ...data,
            status: 'pending'
        });
        if (error) throw new Error(`Database Error: ${error.message}`);
        return true;
    },

    /**
     * Get pending reminders that are due
     */
    getPendingReminders: async () => {
        try {
            const now = new Date().toISOString();
            const snapshot = await db.collection('reminders')
                .where('status', '==', 'pending')
                .where('scheduled_time', '<=', now)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            log.error('Firestore getPendingReminders Error:', error.message);
            return [];
        }
    },

    /**
     * Mark reminder as completed
     */
    markCompleted: async (id) => {
        try {
            await db.collection('reminders').doc(id).update({ 
                status: 'completed',
                completed_at: new Date().toISOString()
            });
            return true;
        } catch (error) {
            log.error('Firestore markCompleted Error:', error.message);
            return false;
        }
    },

    /**
     * Public method to schedule a reminder
     */
    schedule: async (time, message, remoteJid) => {
        const userId = remoteJid.split('@')[0];
        log.info(`Scheduling persistent reminder at ${time} for ${userId}`);
        
        const targetDate = new Date(time);
        if (targetDate.getTime() < Date.now()) {
            throw new Error('Waktu pengingat sudah lewat.');
        }

        // 1. Save to Firestore
        await reminderService.saveReminder({
            user_id: userId,
            remote_jid: remoteJid,
            scheduled_time: targetDate.toISOString(),
            message: message
        });

        // 2. Sync to Google Tasks (Background)
        try {
            const { googleService } = await import('./googleService.js');
            await googleService.addTask(
                `🔔 [ARUTHTALE] ${message}`,
                `Jadwal: ${new Date(time).toLocaleString('id-ID')}\nWhatsApp JID: ${remoteJid}`
            );
            log.success('Reminder synced to Google Tasks.');
        } catch (err) {
            log.warn('Google Tasks Sync Failed:', err.message);
        }

        return true;
    },

    /**
     * Background scanner to fire reminders
     */
    init: (sock) => {
        log.system('Initializing Persistent Reminder Scanner...');
        
        // Scan every 30 seconds
        setInterval(async () => {
            try {
                const reminders = await reminderService.getPendingReminders();

                for (const reminder of reminders) {
                    log.info(`🔔 Firing reminder for ${reminder.user_id}: ${reminder.message}`);
                    
                    // Send WhatsApp notification
                    await sock.sendMessage(reminder.remote_jid, {
                        text: `🔔 *PENGINGAT ARUTHTALE*\n\n📌 *Pesan:* ${reminder.message}\n📅 *Waktu:* ${new Date(reminder.scheduled_time).toLocaleString('id-ID')}`
                    });

                    // Update status
                    await reminderService.markCompleted(reminder.id);
                }
            } catch (err) {
                log.error('Reminder Scanner Error:', err.message);
            }
        }, 30000);
    }
};

