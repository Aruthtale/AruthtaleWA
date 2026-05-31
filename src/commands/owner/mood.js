import { db } from '../../services/firebaseService.js';
import { settings } from '../../config/settings.js';
import { aiProvider } from '../../ai/provider.js';
import { log } from '../../utils/logger.js';

export const help = `🧠 *Bantuan !mood*

Analisis mood dan jurnal mingguan Anda.

*Cara Penggunaan:* \`!mood\` (Tanpa argumen)

*Fitur:* Mengambil data memori 7 hari terakhir dan memberikan ringkasan kondisi psikologis serta saran kesehatan mental.

*Authorized:* Owner Only.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];

    if (senderNumber !== settings.ownerNumber) {
        return await sock.sendMessage(remoteJid, { text: '🔒 Fitur ini eksklusif untuk Owner.' }, { quoted: m });
    }

    try {
        await sock.sendMessage(remoteJid, { text: '🔍 *Menganalisis jurnal dan pola interaksi seminggu terakhir...*' }, { quoted: m });

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Fetch last 7 days of owner messages
        const snapshot = await db.collection('memories')
            .where('user_id', '==', remoteJid)
            .where('role', '==', 'user')
            .where('created_at', '>=', sevenDaysAgo)
            .orderBy('created_at', 'asc')
            .get();

        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                created_at: data.created_at.toDate().toISOString()
            };
        });

        if (logs.length < 5) {
            return await sock.sendMessage(remoteJid, { text: '⚠️ Data tidak cukup untuk melakukan analisis mood. Teruslah berinteraksi dan melakukan journaling malam!' });
        }

        const journalContext = logs.map(l => `[${l.created_at.split('T')[0]}]: ${l.content}`).join('\n');
        
        const analysisPrompt = `Berikut adalah log pesan dan jurnal dari Zen selama 7 hari terakhir:\n\n${journalContext}\n\n` +
                              `TUGAS:\n` +
                              `1. Identifikasi pola mood dominan minggu ini.\n` +
                              `2. Sebutkan 3 pencapaian utama yang disebutkan.\n` +
                              `3. Berikan saran kesehatan mental atau produktivitas yang relevan.\n` +
                              `4. Gunakan gaya bahasa Aruthtale yang empatik dan cerdas.`;

        const result = await aiProvider.chat(analysisPrompt, {
            systemInstruction: "Kamu adalah Aruthtale, asisten pribadi sekaligus teman curhat Zen yang cerdas dan empatik."
        });

        await sock.sendMessage(remoteJid, { 
            text: `🧠 *WEEKLY MOOD & REFLECTION REPORT*\n\n${result.text}` 
        }, { quoted: m });

    } catch (err) {
        log.error('Mood Analysis failed:', err.message);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal melakukan analisis: ${err.message}` });
    }
};
