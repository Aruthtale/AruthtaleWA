import { cctvService } from '../../services/cctvService.js';
import { log } from '../../utils/logger.js';
import fs from 'fs';

export const help = `📹 *Bantuan !cctv (Owner Only)*

Pantau kondisi lalu lintas Indonesia secara real-time.

*Cara Penggunaan:*
1. \`!cctv list\` - Lihat daftar kota tersedia.
2. \`!cctv <kota>\` - Lihat daftar lokasi di kota tersebut.
3. \`!cctv <kota> <lokasi>\` - Ambil foto CCTV di lokasi tersebut.
4. \`!cctv cari <keyword>\` - Cari kamera di seluruh Indonesia.

*Contoh:*
- \`!cctv bandung pasteur\`
- \`!cctv malang borobudur\`

_Data berasal dari CCTV publik resmi (Dishub/ATCS)._`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const isOwner = m.isOwner;

    // Security Gate: Owner Only
    if (!isOwner) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Fitur ini bersifat sensitif dan hanya dapat diakses oleh *Owner*.' 
        }, { quoted: m });
    }

    const subCommand = args[0]?.toLowerCase();
    const sources = cctvService.getSources();

    try {
        // 1. !cctv list
        if (subCommand === 'list') {
            const cities = [...new Set(sources.map(s => s.kota))];
            let msg = '🏙️ *Daftar Kota Tersedia:* \n\n';
            cities.forEach((c, i) => msg += `${i + 1}. ${c}\n`);
            msg += '\n_Ketik `!cctv <kota>` untuk melihat lokasi._';
            return await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
        }

        // 2. !cctv cari <keyword>
        if (subCommand === 'cari' || subCommand === 'search') {
            const query = args.slice(1).join(' ').toLowerCase();
            if (!query) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan kata kunci pencarian!' }, { quoted: m });

            const matches = sources.filter(s => 
                s.kota.toLowerCase().includes(query) || 
                s.lokasi.toLowerCase().includes(query)
            );

            if (matches.length === 0) return await sock.sendMessage(remoteJid, { text: `❌ Kamera dengan kata kunci "${query}" tidak ditemukan.` }, { quoted: m });

            let msg = `🔍 *Hasil Pencarian: "${query}"* \n\n`;
            matches.forEach((s, i) => msg += `${i + 1}. [${s.kota}] ${s.lokasi}\n`);
            msg += '\n_Gunakan `!cctv <kota> <lokasi>` untuk melihat._';
            return await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
        }

        // 3. Handle City or Direct Location
        if (args.length > 0) {
            const cityQuery = args[0].toLowerCase();
            const citySources = sources.filter(s => s.kota.toLowerCase() === cityQuery);

            if (citySources.length > 0) {
                // If only city name is provided, show locations in that city
                if (args.length === 1) {
                    let msg = `📍 *Daftar CCTV: ${citySources[0].kota}* \n\n`;
                    citySources.forEach((s, i) => msg += `${i + 1}. ${s.lokasi}\n`);
                    msg += '\n_Gunakan `!cctv <kota> <lokasi>` untuk melihat._';
                    return await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
                }

                // If city and location part are provided
                const locationQuery = args.slice(1).join(' ').toLowerCase();
                const target = citySources.find(s => s.lokasi.toLowerCase().includes(locationQuery));

                if (!target) return await sock.sendMessage(remoteJid, { text: `❌ Lokasi "${locationQuery}" di kota ${citySources[0].kota} tidak ditemukan.` }, { quoted: m });

                // Capture and Send
                await sock.sendMessage(remoteJid, { text: `⏳ *Mengambil gambar dari CCTV: ${target.lokasi}...*` }, { quoted: m });
                const imagePath = await cctvService.captureFrame(target.url);

                await sock.sendMessage(remoteJid, { 
                    image: fs.readFileSync(imagePath),
                    caption: `✅ *CCTV: ${target.lokasi} (${target.kota})*\n\n_Waktu: ${new Date().toLocaleString('id-ID')}_`
                }, { quoted: m });

                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                return;
            }
        }

        // Default help
        await sock.sendMessage(remoteJid, { text: help }, { quoted: m });

    } catch (error) {
        log.error('CCTV Command Error:', error);
        await sock.sendMessage(remoteJid, { text: `❌ Error: ${error.message}` }, { quoted: m });
    }
};
