import axios from 'axios';
import { log } from '../../utils/logger.js';
import { settings } from '../../config/settings.js';
import { aiProvider } from '../../ai/provider.js';
import { spotifyService } from '../../system/spotify.js';
import { healthService } from '../../system/health.js';
import fs from 'fs';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    await sock.sendMessage(remoteJid, { text: '🩺 *Aruthtale is performing self-diagnostics...*' }, { quoted: m });

    const checks = {
        internet: { name: 'Internet Connectivity', status: '❌', details: '' },
        ai: { name: 'AI Provider (Gemini)', status: '❌', details: '' },
        spotify: { name: 'Spotify API', status: '❌', details: '' },
        supabase: { name: 'Supabase Database', status: '❌', details: '' },
        system: { name: 'Linux System Tools', status: '❌', details: '' }
    };

    // 1. Check Internet
    try {
        await axios.get('https://google.com', { timeout: 5000 });
        checks.internet.status = '✅';
    } catch (e) { checks.internet.details = e.message; }

    // 2. Check AI
    try {
        await aiProvider.chat('ping', { systemInstruction: 'respond with pong' });
        checks.ai.status = '✅';
    } catch (e) { checks.ai.details = 'API Key invalid or rate limited.'; }

    // 3. Check Spotify
    try {
        if (spotifyService.isInitialized) {
            await spotifyService.getMyCurrentPlaybackState();
            checks.spotify.status = '✅';
        } else { checks.spotify.details = 'Not logged in.'; }
    } catch (e) { checks.spotify.details = e.message; }

    // 4. Check Linux Tools
    try {
        const stats = await healthService.getSystemStats();
        if (stats) checks.system.status = '✅';
    } catch (e) { checks.system.details = 'DBus or playerctl not responding.'; }

    // Build Report
    let report = `🩺 *ARUTHTALE SYSTEM DOCTOR*\n\n`;
    for (const key in checks) {
        const c = checks[key];
        report += `${c.status} *${c.name}*\n${c.details ? `   └─ _${c.details}_\n` : ''}`;
    }

    report += `\n📊 *Bot Uptime:* ${Math.floor(process.uptime() / 60)} minutes\n`;
    report += `📁 *Logs Path:* /logs/audit.json\n\n`;
    report += `_Semua sistem normal jika bertanda ✅._`;

    await sock.sendMessage(remoteJid, { text: report }, { quoted: m });
};
