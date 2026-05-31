import path from 'path';
import fs from 'fs';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { auditLogger } from '../utils/auditLogger.js';
import { authService } from './authService.js';
import { usageService } from './usageService.js';

const commands = new Map();
const cooldowns = new Map();

// Default cooldowns (in ms)
const COOLDOWN_MAP = {
    'gen': 30000,
    'edit': 30000,
    'dl': 20000,
    'img': 20000,
    'summary': 20000,
    'screenshot': 20000,
    'search': 10000,
    'stiker': 5000,
    'qr': 5000,
    'removebg': 30000,
    'hd': 30000,
    'hdvideo': 60000,
    'webss': 20000,
    'leads': 60000
};

/**
 * Load all commands from src/commands recursively
 */
const loadCommands = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith('.js')) {
            const commandName = path.basename(file, '.js').toLowerCase();
            commands.set(commandName, fullPath);
        }
    }
};

// Initial load
const COMMANDS_DIR = path.resolve('src/commands');
loadCommands(COMMANDS_DIR);
log.system(`Loaded ${commands.size} commands.`);

export const reloadCommands = () => {
    commands.clear();
    loadCommands(COMMANDS_DIR);
    log.system('Command Registry Refreshed.');
};

export const routeCommand = async (sock, m, text) => {
    const args = text.slice(settings.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const remoteJid = m.key.remoteJid;
    const realSender = m.key.participant || remoteJid;
    const senderNumber = realSender.split('@')[0];

    // 1. Alias handling
    const aliases = {
        'help': 'menu',
        'ss': 'sys',
        'screenshot': 'sys',
        'vol': 'sys',
        'volume': 'sys',
        'lock': 'sys',
        'bright': 'sys',
        'sleep': 'sys',
        'suspend': 'sys',
        'cp': 'copy',
        'sticker': 'stiker',
        'vstiker': 'vsticker',
        'deepresearch': 'research'
    };
    const targetCommand = aliases[commandName] || commandName;

    // Special handling for sys consolidated hub
    if (aliases[commandName] === 'sys') {
        args.unshift(commandName);
    }

    // 2. Help Flag Detection
    const isHelp = args.includes('--help') || args.includes('-h');

    // 3. Check if command exists
    const commandPath = commands.get(targetCommand);
    if (!commandPath) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ Perintah *!${commandName}* tidak ditemukan.\n\n💡 Ketik *!menu* untuk melihat fitur.` 
        }, { quoted: m });
        return;
    }

    // 4. Access Control
    const isOwner = senderNumber === settings.ownerNumber;
    const isAuthorized = await authService.isAuthorized(senderNumber);

    // Attach to message object for commands to use
    m.isOwner = isOwner;
    m.isAuthorized = isAuthorized;

    const authorizedCommands = ['summary', 'remind', 'gen', 'edit', 'mp3', 'auth', 'stiker', 'vsticker', 'removebg', 'transkrip', 'linestiker', 'research', 'hd', 'leads'];
    const publicCommands = ['ask', 'dl', 'img', 'myid', 'menu', 'help', 'search', 'ocr'];
    
    const isPublic = publicCommands.includes(targetCommand);
    const isAuthorizedCommand = authorizedCommands.includes(targetCommand);

    if (!isPublic && !isOwner) {
        if (isAuthorizedCommand && !isAuthorized) {
            return await sock.sendMessage(remoteJid, { text: '🛡️ Fitur ini khusus untuk *User Terverifikasi*.' }, { quoted: m });
        } else if (!isAuthorizedCommand) {
            return await sock.sendMessage(remoteJid, { text: '🔒 Fitur ini khusus untuk *Owner Aruthtale*.' }, { quoted: m });
        }
    }

    // 5. Rate Limiting per Command
    const cooldownTime = COOLDOWN_MAP[targetCommand] || 2000;
    const cooldownKey = `${senderNumber}:${targetCommand}`;
    const lastUsed = cooldowns.get(cooldownKey) || 0;
    const now = Date.now();

    if (now - lastUsed < cooldownTime) {
        const remaining = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
        return await sock.sendMessage(remoteJid, { 
            text: `⏳ *Slow Down!* Tunggu *${remaining} detik* lagi untuk !${targetCommand}.` 
        }, { quoted: m });
    }

    // 🚀 6. Execute Command
    try {
        const version = global.commandVersion || 1;
        const command = await import(`${commandPath}?v=${version}`);

        if (isHelp && command.help) {
            return await sock.sendMessage(remoteJid, { text: command.help }, { quoted: m });
        }

        await command.default(sock, m, args);
        
        // Finalize
        cooldowns.set(cooldownKey, now);
        await usageService.logUsage(senderNumber, 'COMMAND', 1);
        await auditLogger.logAction({ user: remoteJid, command: targetCommand, args, status: 'success' });

    } catch (error) {
        log.error(`Execution error for !${targetCommand}:`, error.message);
        
        let userMessage = `❌ *Gagal:* Terjadi kesalahan sistem.`;
        if (error.message.includes('rate limit') || error.message.includes('429')) {
            userMessage = `❌ *Rate Limit:* Provider sedang sibuk. Coba lagi dalam 1 menit.`;
        } else if (error.message.includes('402')) {
            userMessage = `❌ *Saldo Habis:* Layanan API provider sedang tidak tersedia.`;
        }

        await sock.sendMessage(remoteJid, { text: userMessage }, { quoted: m });
        await auditLogger.logAction({ user: remoteJid, command: targetCommand, args, status: 'failed', error: error.message });
    }
};
