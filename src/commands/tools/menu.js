import { settings } from '../../config/settings.js';
import { authService } from '../../services/authService.js';
import fs from 'fs';
import path from 'path';

/**
 * Optimized & Minimalist Menu
 */
export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];
    const isOwner = senderNumber === settings.ownerNumber;
    const isAuthorized = await authService.isAuthorized(senderNumber);

    let menuText = isOwner ? `\u{1F451} *ARVERZ OWNER CONSOLE*\n` : `\u{1F31F} *ARVERZ AI ASSISTANT*\n`;
    menuText += `_Your Linux & Personal Automation Partner_\n`;
    menuText += `_Grup: Mention bot untuk chat AI_\n\n`;

    // --- PUBLIC SECTION ---
    menuText += 
        `╭───⊷ \u{1F31F} *PUBLIC*\n` +
        `│ \u26A1 !ask, !dl, !img, !search, !ocr\n` +
        `╰───────────────\n\n`;

    // --- AUTHORIZED SECTION ---
    if (isOwner || isAuthorized) {
        menuText += 
            `╭───⊷ \u{1F916} *SMART TOOLS*\n` +
            `│ \u{1F3A8} !gen, !edit, !hd (AI Image)\n` +
            `│ \u{1F3AB} !stiker, !vsticker, !linestiker, !removebg\n` +
            `│ \u{1F4D1} !summary, !remind, !transkrip, !mp3\n` +
            `╰───────────────\n\n`;
    }

    // --- OWNER SECTION ---
    if (isOwner) {
        menuText += 
            `╭───⊷ \u{1F4BB} *ADMIN CONSOLE*\n` +
            `│ \u{1F512} !sys, !stats, !usage, !logs, !cctv\n` +
            `│ \u{1F4C5} !google, !todo, !jadwal, !mood, !osint\n` +
            `│ \u{1F3AD} !persona, !history, !clearchat, !hdvideo\n` +
            `│ \u{1F511} !auth, !reload, !ping, !spotify, !open\n` +
            `╰───────────────\n\n`;
    }

    menuText += `\u{1F4CA} _v7.1.0 \u2014 Powered by Gemini 3.5 + NVIDIA NIM_`;

    const logoPath = path.resolve(process.cwd(), 'assets/logo.png');
    if (fs.existsSync(logoPath)) {
        await sock.sendMessage(remoteJid, {
            image: fs.readFileSync(logoPath),
            caption: menuText
        }, { quoted: m });
    } else {
        await sock.sendMessage(remoteJid, { text: menuText }, { quoted: m });
    }
};
