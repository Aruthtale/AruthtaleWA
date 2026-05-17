import { googleService } from '../../services/googleService.js';
import { aiProvider } from '../../ai/provider.js';
import { react } from '../../utils/react.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const rawText = args.join(' ');
    if (!rawText) return sock.sendMessage(m.key.remoteJid, { text: '❌ Masukkan agenda (contoh: !jadwal meeting besok jam 10 pagi).' });

    try {
        await react(sock, m, '📅');
        
        // Use AI to parse time and title
        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const prompt = `Sekarang: ${now}. User ingin buat jadwal: "${rawText}".\n` +
                      `Ekstrak 'summary' (judul) dan 'startTime' (ISO format).\n` +
                      `Balas HANYA JSON: {"summary": "...", "startTime": "YYYY-MM-DDTHH:mm:ss"}.`;
        
        const response = await aiProvider.chat(prompt, { systemInstruction: "Kamu adalah parser jadwal akurat. Keluarkan JSON murni." });
        const data = JSON.parse(response.text.replace(/```json|```/g, '').trim());

        await googleService.addEvent(data.summary, data.startTime);
        
        await react(sock, m, '✅');
        const localTime = new Date(data.startTime).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
        return sock.sendMessage(m.key.remoteJid, { text: `✅ *Agenda Tersimpan!*\n\n📌 *Event:* ${data.summary}\n📅 *Waktu:* ${localTime}` });
        
    } catch (err) {
        log.error('Jadwal Error:', err.message);
        return sock.sendMessage(m.key.remoteJid, { text: `❌ Gagal memproses jadwal: ${err.message}` });
    }
};
