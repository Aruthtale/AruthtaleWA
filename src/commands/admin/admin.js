import { log } from '../../utils/logger.js';
import { settings } from '../../config/settings.js';

export default async function execute(sock, m, args) {
    const remoteJid = m.key.remoteJid;
    const senderNumber = remoteJid.split('@')[0];

    // Only owner can access admin menu
    if (senderNumber !== settings.ownerNumber) {
        log.warn(`🛡️ Admin access denied: !admin from ${remoteJid}`);
        return await sock.sendMessage(remoteJid, { text: "❌ Akses ditolak. Hanya owner yang bisa membuka Dashboard Admin." });
    }

    const subCommand = args[0]?.toLowerCase();

    // Default to menu if no subcommand or 'menu' is specified
    if (subCommand === 'menu' || !subCommand) {
        const sections = [
            {
                title: '🖥️ System Control',
                rows: [
                    { title: '🔒 Lock Screen', rowId: '!lock', description: 'Kunci layar laptop segera' },
                    { title: '💤 Suspend System', rowId: '!suspend', description: 'Mode tidur (hemat energi)' },
                    { title: '📸 Screenshot', rowId: '!ss', description: 'Ambil gambar layar laptop saat ini' },
                    { title: '📊 System Status', rowId: '!status', description: 'Cek CPU, RAM, dan Suhu' }
                ]
            },
            {
                title: '🔊 Audio & Display',
                rows: [
                    { title: '🔊 Volume 100%', rowId: '!volume 100', description: 'Set volume maksimal' },
                    { title: '🔉 Volume 50%', rowId: '!volume 50', description: 'Set volume sedang' },
                    { title: '🔇 Mute Volume', rowId: '!volume 0', description: 'Matikan suara' },
                    { title: '☀️ Brightness Max', rowId: '!bright 100', description: 'Kecerahan layar maksimal' }
                ]
            },
            {
                title: '🩺 Maintenance',
                rows: [
                    { title: '🩺 Proactive Doctor', rowId: '!doctor', description: 'Cek kesehatan sistem & proses berat' },
                    { title: '🧹 Cleanup Cache', rowId: '!cleanup', description: 'Bersihkan file sampah sementara' },
                    { title: '💾 Backup Data', rowId: '!backup', description: 'Backup database & session' }
                ]
            }
        ];

        await sock.sendMessage(remoteJid, {
            text: `🛠️ *Aruthtale Admin Dashboard*\nSelamat datang Zen! Pilih kontrol yang ingin Anda eksekusi dari daftar di bawah.`,
            footer: 'Aruthtale AI Assistant v3.2.0',
            buttonText: 'Dashboard Utama',
            sections
        });
    } else {
        await sock.sendMessage(remoteJid, { text: `❓ Sub-perintah *!admin ${subCommand}* tidak ditemukan. Gunakan *!admin menu* untuk melihat daftar kontrol.` });
    }
}
