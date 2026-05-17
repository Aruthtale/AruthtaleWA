import { log } from '../../utils/logger.js';
import { launchApp } from '../../utils/system.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const appName = args.join(' ');

    if (!appName) {
        return sock.sendMessage(remoteJid, { text: "Format: !open [nama-aplikasi]\nContoh: !open firefox" });
    }

    try {
        log.system(`Opening application: ${appName}`);
        
        const { success, error } = await launchApp(appName);
        
        if (success) {
            await sock.sendMessage(remoteJid, { text: `🚀 *Berhasil memproses pembukaan:* ${appName}` });
        } else {
            await sock.sendMessage(remoteJid, { text: `❌ *Gagal membuka ${appName}*\n\nDetail: \`${error}\`\nCoba ketik nama aplikasinya lebih spesifik.` });
        }
    } catch (error) {
        log.error(`Launch Error: ${error.message}`);
        await sock.sendMessage(remoteJid, { text: `❌ Gagal membuka ${appName}` });
    }
};
