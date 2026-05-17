import { log } from '../../utils/logger.js';

export const help = `🎭 *Bantuan !persona*

Mengubah kepribadian atau instruksi khusus untuk AI dalam percakapan Anda.

*Format:* \`!persona [deskripsi_kepribadian]\`
*Contoh:* \`!persona jawab seperti anak kecil yang sangat ceria\`
*Reset:* \`!persona reset\`

*Akses:* Public.`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const persona = args.join(' ');

    if (!persona) {
        return await sock.sendMessage(remoteJid, { text: '❌ Masukkan deskripsi persona yang diinginkan.' }, { quoted: m });
    }

    if (!global.userPersonas) global.userPersonas = new Map();

    if (persona.toLowerCase() === 'reset') {
        global.userPersonas.delete(remoteJid);
        return await sock.sendMessage(remoteJid, { text: '✅ *Berhasil!* Persona telah di-reset ke default.' }, { quoted: m });
    }

    global.userPersonas.set(remoteJid, persona);
    log.info(`Persona set for ${remoteJid}: ${persona}`);

    await sock.sendMessage(remoteJid, { 
        text: `✅ *Berhasil!* Persona Anda telah diatur.\n\n*Sekarang AI akan:* ${persona}` 
    }, { quoted: m });
};
