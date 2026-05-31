import { leadService } from '../../services/leadService.js';
import { googleService } from '../../services/googleService.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

/**
 * Command: !leads <prompt> [--sheet <id>]
 * Menjalankan Agentic Logic Loop untuk mencari leads bisnis.
 */
export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    
    // Check if authorized
    if (!m.isOwner && !m.isAuthorized) {
        return sock.sendMessage(remoteJid, { text: '🛡️ Fitur ini khusus untuk *User Terverifikasi*.' }, { quoted: m });
    }

    const DEFAULT_SHEET_ID = '1pIDrJw5lCz3cFSRcUcRbJcD1ZUdIqddhwabzaHm3anQ';
    let spreadsheetId = '';
    const sheetIdx = args.indexOf('--sheet');
    if (sheetIdx !== -1 && args[sheetIdx + 1]) {
        spreadsheetId = args[sheetIdx + 1];
        args.splice(sheetIdx, 2);
    } else {
        spreadsheetId = DEFAULT_SHEET_ID;
    }

    const prompt = args.join(' ');
    if (!prompt) {
        return sock.sendMessage(remoteJid, { 
            text: '❌ Masukkan perintah pencarian.\nContoh: `!leads cari 10 kafe di Jatinegara`' 
        }, { quoted: m });
    }

    try {
        await react(sock, m, '🕵️');

        // Verify/Create sheet headers if using a new or specific sheet
        if (spreadsheetId === DEFAULT_SHEET_ID) {
            log.info(`[Leads] Using default spreadsheet: ${DEFAULT_SHEET_ID}`);
        } else {
            log.info(`[Leads] Using custom spreadsheet: ${spreadsheetId}`);
        }

        await leadService.execute(prompt, spreadsheetId, sock, remoteJid);
        await react(sock, m, '✅');
        
    } catch (error) {
        log.error('Leads Command Error:', error.message);
        await react(sock, m, '❌');
        await sock.sendMessage(remoteJid, { text: `❌ *Gagal:* ${error.message}` }, { quoted: m });
    }
};

export const help = `🔍 *Lead Generation Agent*
Perintah ini menjalankan proses otomatis untuk mencari target bisnis.

*Penggunaan:*
!leads <perintah> [--sheet <id>]

*Contoh:*
!leads cari 10 coffee shop di Jakarta Timur
!leads cari 5 salon di Bekasi --sheet spreadsheet_id_anda

*Alur Kerja:*
1. Dekonstruksi perintah
2. Pencarian data (Discovery)
3. Investigasi website & medsos
4. Penyusunan data ke Google Sheets`;
