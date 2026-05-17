import { createClient } from '@supabase/supabase-js';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { aiProvider } from '../ai/provider.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

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
     * Save reminder to Supabase
     */
    schedule: async (time, message, remoteJid) => {
        const userId = remoteJid.split('@')[0];
        log.info(`Scheduling persistent reminder at ${time} for ${userId}`);
        
        const targetDate = new Date(time);
        if (targetDate.getTime() < Date.now()) {
            throw new Error('Waktu pengingat sudah lewat.');
        }

        // 1. Save to Supabase
        const { error } = await supabase
            .from('reminders')
            .insert([{
                user_id: userId,
                remote_jid: remoteJid,
                scheduled_time: targetDate.toISOString(),
                message: message,
                status: 'pending'
            }]);

        if (error) throw new Error(`Database Error: ${error.message}`);

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
            // Don't throw error here, so Supabase reminder still works
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
                const now = new Date().toISOString();
                
                // Fetch pending reminders that are due
                const { data, error } = await supabase
                    .from('reminders')
                    .select('*')
                    .eq('status', 'pending')
                    .lte('scheduled_time', now);

                if (error) throw error;

                for (const reminder of data) {
                    log.info(`🔔 Firing reminder for ${reminder.user_id}: ${reminder.message}`);
                    
                    // Send WhatsApp notification
                    await sock.sendMessage(reminder.remote_jid, {
                        text: `🔔 *PENGINGAT ARUTHTALE*\n\n📌 *Pesan:* ${reminder.message}\n📅 *Waktu:* ${new Date(reminder.scheduled_time).toLocaleString('id-ID')}`
                    });

                    // Update status
                    await supabase
                        .from('reminders')
                        .update({ status: 'completed' })
                        .eq('id', reminder.id);
                }
            } catch (err) {
                log.error('Reminder Scanner Error:', err.message);
            }
        }, 30000);
    }
};
