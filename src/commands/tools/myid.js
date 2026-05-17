export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const cleanId = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    
    const response = `🆔 *WhatsApp ID Anda:*\n\n` +
                     `\`${cleanId}\`\n\n` +
                     `Silakan kirim nomor ini ke Owner untuk didaftarkan ke sistem.`;

    await sock.sendMessage(remoteJid, { text: response }, { quoted: m });
};
