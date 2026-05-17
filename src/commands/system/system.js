import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { aiProvider } from '../../ai/provider.js';
const execAsync = promisify(exec);

export default async (sock, m, args) => {
    const uptime = Math.floor(os.uptime() / 3600);
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100;
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100;
    const cpuLoad = os.loadavg()[0].toFixed(2);

    let batteryInfo = 'N/A';
    try {
        const { stdout: capacity } = await execAsync('cat /sys/class/power_supply/BAT0/capacity');
        const { stdout: status } = await execAsync('cat /sys/class/power_supply/BAT0/status');
        batteryInfo = `${capacity.trim()}% (${status.trim()})`;
    } catch (e) {
        batteryInfo = 'Unknown (BAT0 not found)';
    }

    // Get AI Insight
    let aiInsight = '';
    try {
        const aiPrompt = `STATUS HARDWARE LAPTOP:\n` +
                         `- RAM: ${Math.round((totalMem - freeMem) * 10) / 10}GB Terpakai / ${totalMem}GB\n` +
                         `- CPU Load (1m): ${cpuLoad}\n` +
                         `- Baterai: ${batteryInfo}\n` +
                         `- Uptime: ${uptime} jam\n\n` +
                         `TUGAS: Berikan analisis sistem Admin Linux.\n` +
                         `1. Jika CPU Load > 2.0 atau RAM > 80%, peringatkan untuk mematikan aplikasi berat atau reboot.\n` +
                         `2. Jika Baterai < 20% dan tidak charging, suruh colok charger SEGERA.\n` +
                         `3. Berikan instruksi singkat tindakan apa yang harus saya lakukan sekarang.\n` +
                         `4. Jangan menyapa, langsung ke analisis teknis.`;
        
        aiInsight = await aiProvider.chat(aiPrompt, { 
            systemInstruction: "Kamu adalah Linux Admin Advisor yang tegas dan teknis. Fokus pada kesehatan hardware dan stabilitas OS." 
        });
    } catch (e) {
        aiInsight = "Data sistem stabil. Lanjutkan aktivitas.";
    }

    const report = `💻 *System Status*\n\n` +
                   `⏱️ *Uptime:* ${uptime} hours\n` +
                   `🧠 *RAM:* ${Math.round((totalMem - freeMem) * 10) / 10}GB / ${totalMem}GB used\n` +
                   `⚡ *CPU Load:* ${cpuLoad} (1m avg)\n` +
                   `🔋 *Battery:* ${batteryInfo}\n` +
                   `🌡️ *Platform:* ${os.platform()} (${os.release()})\n\n` +
                   `🤖 *AI INSIGHT:*\n` +
                   `_"${aiInsight.trim()}"_`;

    await sock.sendMessage(m.key.remoteJid, { text: report }, { quoted: m });
};
