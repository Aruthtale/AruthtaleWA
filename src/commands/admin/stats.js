import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from '../../config/settings.js';
import { authService } from '../../services/authService.js';
import { db } from '../../services/firebaseService.js';

const execAsync = promisify(exec);

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;

    if (!isOwner) return;

    try {
        // 1. Get Disk Space (Linux)
        const { stdout: diskInfo } = await execAsync("df -h . | tail -1 | awk '{print $4}'");
        const freeSpace = diskInfo.trim();

        // 2. Get User Counts (Firestore)
        const whitelistSnapshot = await db.collection('whitelist').get();
        const dynamicUserCount = whitelistSnapshot.size;
        const staticUserCount = settings.authorizedNumbers.length;

        // 3. Get Cache Stats
        const cacheCountSnapshot = await db.collection('media_cache').count().get();
        const cacheCount = cacheCountSnapshot.data().count;

        // 4. Get Daily Usage (Total across all users)
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const usageSnapshot = await db.collection('usage_log')
            .where('created_at', '>=', today)
            .get();
        
        let totalTokens = 0;
        let totalDownloadMb = 0;
        
        usageSnapshot.forEach(doc => {
            const row = doc.data();
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
