import volume from './volume.js';
import lock from './lock.js';
import suspend from './suspend.js';
import screenshot from './screenshot.js';
import bright from './bright.js';
import monitor from './monitor.js';
import dashboard from './dashboard.js';

export default async (sock, m, args) => {
    const subCommand = args[0]?.toLowerCase();
    const subArgs = args.slice(1);

    switch (subCommand) {
        case 'vol':
        case 'volume':
            return await volume(sock, m, subArgs);
        case 'lock':
            return await lock(sock, m, subArgs);
        case 'ss':
        case 'scr':
        case 'screenshot':
            return await screenshot(sock, m, subArgs);
        case 'bright':
            return await bright(sock, m, subArgs);
        case 'sleep':
        case 'suspend':
            return await suspend(sock, m, subArgs);
        case 'monitor':
            return await monitor(sock, m, subArgs);
        case 'dashboard':
            return await dashboard(sock, m, subArgs);
        default:
            const text = `🛠️ *PC CONTROL CENTER*\n\n` +
                         `• *!sys vol <n>* : Atur volume (0-100)\n` +
                         `• *!sys ss* : Ambil screenshot\n` +
                         `• *!sys lock* : Kunci layar\n` +
                         `• *!sys bright <n>* : Atur kecerahan\n` +
                         `• *!sys sleep* : Mode suspend\n` +
                         `• *!sys monitor* : Status hardware\n` +
                         `• *!sys dashboard* : System dashboard`;
            await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
    }
};
