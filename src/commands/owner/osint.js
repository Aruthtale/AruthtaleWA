import { osintService } from '../../services/osintService.js';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';
import { aiProvider } from '../../ai/provider.js';
import fs from 'fs';

export default async function osintCommand(sock, m, args) {
    const remoteJid = m.key.remoteJid;
    const type = args[0]?.toLowerCase();
    const target = args[1];

    if (!type) {
        return await sock.sendMessage(remoteJid, { 
            text: `*🔍 Aruthtale OSINT Suite*\n\n` +
                  `*Perintah Dasar:*\n` +
                  `• !osint email <email>\n` +
                  `• !osint user <username>\n\n` +
                  `*Perintah Lanjutan:*\n` +
                  `• !osint domain <domain> - Investigasi teknis domain.\n` +
                  `• !osint dork <target/topik> - Buat query Google Dorking.\n` +
                  `• !osint check <link> - Visual Scraper (Screenshot + AI Analysis).\n\n` +
                  `*Contoh:*\n` +
                  `!osint domain google.com\n` +
                  `!osint dork config file site:nasa.gov\n` +
                  `!osint check https://tokopedia.com/product-link`
        }, { quoted: m });
    }

    // --- 1. Email & User (Legacy logic kept for brevity/refactor later if needed) ---
    // (Existing Holehe/Sherlock logic would go here, but let's focus on new ones)
    if (type === 'email' || type === 'user') {
        const { default: legacyOsint } = await import('./osint_legacy.js'); // Moved legacy to separate file
        return await legacyOsint(sock, m, args);
    }

    // --- 2. Domain Investigator ---
    if (type === 'domain') {
        if (!target) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan nama domain!' }, { quoted: m });
        await react(sock, m, '⏳');
        
        try {
            const data = await osintService.investigateDomain(target);
            const msg = `*🔍 Domain Investigation: ${target}*\n\n` +
                        `📂 *WHOIS Data (Top 10):*\n\`\`\`${data.whois}\`\`\`\n\n` +
                        `🌐 *DNS Records (ANY):*\n${data.dns.map(d => `• ${d}`).join('\n') || 'N/A'}\n\n` +
                        `🔓 *Open Ports (Nmap):*\n${data.ports.map(p => `• ${p}`).join('\n') || 'No common ports open'}\n\n` +
                        `_Analisis teknis Aruthtale._`;
            
            await react(sock, m, '✅');
            await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
        } catch (err) {
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ Gagal investigasi domain: ${err.message}` }, { quoted: m });
        }
    }

    // --- 3. Dorking Assistant ---
    else if (type === 'dork') {
        const query = args.slice(1).join(' ');
        if (!query) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan target atau topik dorking!' }, { quoted: m });
        
        await react(sock, m, '🧠');
        try {
            const aiPrompt = `Buatlah 5-8 query Google Dorking yang cerdas dan spesifik untuk mencari informasi sensitif atau tersembunyi terkait: "${query}".\n` +
                            `Sertakan penjelasan singkat untuk setiap query.\n` +
                            `Format output: [Query] - [Penjelasan]\n\n` +
                            `Contoh query: site:target.com filetype:log, intitle:"index of" "config.php", dll.`;
            
            const result = await aiProvider.chat(aiPrompt, {
                systemInstruction: "Kamu adalah pakar OSINT dan Google Dorking. Berikan query yang akurat dan berbahaya jika disalahgunakan (untuk tujuan edukasi/investigasi owner)."
            });

            const msg = `*🔍 Dorking Assistant: ${query}*\n\n` +
                        `${result.text}\n\n` +
                        `⚠️ *Peringatan:* Gunakan hanya untuk tujuan legal dan etis.`;
            
            await react(sock, m, '✅');
            await sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
        } catch (err) {
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ Gagal membuat dork: ${err.message}` }, { quoted: m });
        }
    }

    // --- 4. Visual Scraper (Check) ---
    else if (type === 'check') {
        let url = target;
        if (!url) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan link website!' }, { quoted: m });
        if (!url.startsWith('http')) url = 'https://' + url;

        await react(sock, m, '📸');
        await sock.sendMessage(remoteJid, { text: `⏳ *Sedang membuka website...*\n_Harap tunggu, ini mungkin memakan waktu 10-20 detik._` }, { quoted: m });

        try {
            const screenshotPath = await osintService.captureScreenshot(url);
            
            // AI Analysis (using Gemini Vision)
            await react(sock, m, '🧠');
            const analysisPrompt = `Analisis screenshot website ini (${url}). Cari informasi penting seperti harga produk, stok, judul artikel, atau ringkasan konten utama. Berikan laporan yang rapi dan informatif. Jika ini halaman produk, berikan detail harga secara jelas.`;
            
            const screenshotBuffer = fs.readFileSync(screenshotPath);
            const base64Image = screenshotBuffer.toString('base64');
            
            const analysis = await aiProvider.chat(analysisPrompt, {
                image: base64Image,
                task: 'VISION',
                systemInstruction: "Kamu adalah Visual Intelligence Assistant. Analisis gambar website dan ekstrak data penting dengan akurasi tinggi."
            });

            await sock.sendMessage(remoteJid, {
                image: screenshotBuffer,
                caption: `✅ *Visual Analysis: ${url}*\n\n${analysis.text}\n\n_Waktu: ${new Date().toLocaleString('id-ID')}_`
            }, { quoted: m });

            if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
            await react(sock, m, '✅');

        } catch (err) {
            log.error('Visual Scraper Error:', err.message);
            await react(sock, m, '❌');
            await sock.sendMessage(remoteJid, { text: `❌ Gagal menganalisis website: ${err.message}` }, { quoted: m });
        }
    }
}

export const help = `*🔍 OSINT Command Suite*
Alat investigasi dan intelijen web.

*Perintah:*
!osint email <email> - Lacak registrasi email.
!osint user <user> - Cari username.
!osint domain <domain> - Investigasi teknis (WHOIS, DNS, Ports).
!osint dork <query> - Generate Google Dorks.
!osint check <url> - Screenshot + Analisis AI Vision.

*Akses:* Owner Only`;
