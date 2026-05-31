import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

const execAsync = promisify(exec);
const HOLEHE_PATH = '/home/zennrch/.local/bin/holehe';
const SHERLOCK_PATH = '/home/zennrch/.local/bin/sherlock';

export default async function legacyOsint(sock, m, args) {
    const remoteJid = m.key.remoteJid;
    const type = args[0]?.toLowerCase();
    const target = args[1];

    if (type === 'email') {
        if (!target.includes('@') || !target.includes('.')) {
            return await sock.sendMessage(remoteJid, { text: `❌ Format email tidak valid.` }, { quoted: m });
        }
        await react(sock, m, '⏳');
        await sock.sendMessage(remoteJid, { text: `🔍 *OSINT Target:* ${target}\nSedang melakukan pengecekan di 120+ situs...` }, { quoted: m });
        try {
            const { stdout } = await execAsync(`${HOLEHE_PATH} ${target} --only-used --no-color --no-clear`, { timeout: 60000 });
            const foundSites = stdout.split('\n')
                .filter(line => line.startsWith('[+]') && !line.includes('Email used'))
                .map(line => line.replace('[+]', '✅').trim());
            if (foundSites.length === 0) {
                await react(sock, m, '✅');
                return await sock.sendMessage(remoteJid, { text: `✅ *Hasil OSINT:* Tidak ditemukan jejak digital untuk email *${target}*.` }, { quoted: m });
            }
            const message = `*🔍 Hasil OSINT Email: ${target}*\n\nEmail terdaftar di *${foundSites.length}* situs:\n\n${foundSites.join('\n')}`;
            await react(sock, m, '✅');
            await sock.sendMessage(remoteJid, { text: message }, { quoted: m });
        } catch (error) {
            log.error('Holehe Error:', error.message);
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ *Gagal:* ${error.message}` }, { quoted: m });
        }
    } else if (type === 'user') {
        await react(sock, m, '⏳');
        await sock.sendMessage(remoteJid, { text: `🔍 *OSINT Username:* ${target}\nSedang mencari di ratusan situs...` }, { quoted: m });
        try {
            const { stdout } = await execAsync(`${SHERLOCK_PATH} ${target} --no-color --print-found --timeout 5`, { timeout: 120000 });
            const foundSites = stdout.split('\n')
                .filter(line => line.includes('found at') || line.startsWith('[+]'))
                .map(line => `✅ ${line.replace('[+]', '').trim()}`);
            if (foundSites.length === 0) {
                await react(sock, m, '✅');
                return await sock.sendMessage(remoteJid, { text: `✅ *Hasil OSINT:* Username *${target}* tidak ditemukan.` }, { quoted: m });
            }
            const message = `*🔍 Hasil OSINT Username: ${target}*\n\nDitemukan di *${foundSites.length}* situs:\n\n${foundSites.join('\n')}`;
            await react(sock, m, '✅');
            await sock.sendMessage(remoteJid, { text: message }, { quoted: m });
        } catch (error) {
            log.error('Sherlock Error:', error.message);
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ *Gagal:* ${error.message}` }, { quoted: m });
        }
    }
}
