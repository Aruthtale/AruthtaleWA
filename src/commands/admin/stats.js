import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from '../../config/settings.js';
import { authService } from '../../services/authService.js';
import { createClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);
const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;

    if (!isOwner) return;

    try {
        // 1. Get Disk Space (Linux)
        const { stdout: diskInfo } = await execAsync("df -h . | tail -1 | awk '{print $4}'");
        const freeSpace = diskInfo.trim();

        // 2. Get User Counts (Supabase)
        const { data: whitelistData } = await supabase.from('whitelist').select('number', { count: 'exact' });
        const dynamicUserCount = whitelistData ? whitelistData.length : 0;
        const staticUserCount = settings.authorizedNumbers.length;

        // 3. Get Cache Stats
        const { count: cacheCount } = await supabase.from('media_cache').select('*', { count: 'exact', head: true });

        // 4. Get Daily Usage (Total across all users)
        const today = new Date();
        today.setHours(0,0,0,0);
        const { data: usageData } = await supabase.from('usage_log').select('type, amount').gte('created_at', today.toISOString());
        
        let totalTokens = 0;
        let totalDownloadMb = 0;
        usageData?.forEach(row => {
            if (row.type === 'AI_TOKENS') totalTokens += parseFloat(row.amount);
            if (row.type === 'DOWNLOAD_MB') totalDownloadMb += parseFloat(row.amount);
        });

        // 5. Uptime
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const statsText = `📊 *SYSTEM STATISTICS* 📊\n\n` +
            `🖥️ *OS:* Linux\n` +
            `⏱️ *Uptime:* ${hours}j ${minutes}m\n` +
            `💾 *Free Storage:* ${freeSpace}\n\n` +
            `👥 *Users:*\n` +
            `  • Static: ${staticUserCount}\n` +
            `  • Dynamic: ${dynamicUserCount}\n` +
            `  • Total Auth: ${staticUserCount + dynamicUserCount}\n\n` +
            `📈 *Usage Today (All):*\n` +
            `  • AI Tokens: ${totalTokens.toLocaleString()}\n` +
            `  • Downloads: ${totalDownloadMb.toFixed(1)} MB\n\n` +
            `📦 *Database:*\n` +
            `  • Media Cache: ${cacheCount || 0} items\n\n` +
            `⚙️ *Environment:* Production`;

        await sock.sendMessage(remoteJid, { text: statsText }, { quoted: m });
    } catch (err) {
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengambil statistik: ${err.message}` });
    }
};
