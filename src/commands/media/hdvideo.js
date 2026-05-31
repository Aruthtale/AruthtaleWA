import { downloadMediaMessage } from '@whiskeysockets/baileys';
import Replicate from 'replicate';
import { Client } from '@gradio/client';
import { File } from 'node:buffer';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

export const help = `📹 *Bantuan !hdvideo*

Meningkatkan resolusi video pendek menjadi HD / Tajam menggunakan Cloud AI.

*Format:* 
- Balas video pendek dengan \`!hdvideo\`

*Akses:* Owner Only (Admin)
*Batasan:* Maksimal durasi video 10 detik
*Cooldown:* 60 detik`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // Mendeteksi video dari berbagai jenis payload (termasuk ViewOnce)
    const videoMessage = m.message?.videoMessage || 
                         m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
                         m.message?.viewOnceMessage?.message?.videoMessage ||
                         m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message?.videoMessage;

    if (!videoMessage) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Balas video pendek yang ingin di-HD dengan perintah *!hdvideo*' 
        }, { quoted: m });
    }

    // Safeguard: Batas durasi maksimal 10 detik
    const duration = videoMessage.seconds || 0;
    if (duration > 10) {
        return await sock.sendMessage(remoteJid, { 
            text: `❌ Durasi video terlalu panjang (*${duration} detik*). Maksimal durasi video adalah *10 detik* untuk menjaga stabilitas pemrosesan cloud.` 
        }, { quoted: m });
    }

    try {
        log.wa(`Processing HD video upscaling for Owner: ${remoteJid} (Duration: ${duration}s)`);
        await react(sock, m, '⏳');
        const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mendownload media video dari WhatsApp...*' }, { quoted: m });

        // Tentukan message object yang akan didownload
        const downloadMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage ? 
            { message: m.message.extendedTextMessage.contextInfo.quotedMessage } : m;

        // Download video buffer dari WhatsApp
        const buffer = await downloadMediaMessage(
            downloadMessage,
            'buffer',
            {},
            { logger: log }
        );

        if (!buffer) throw new Error('Gagal mendownload media video dari WhatsApp.');

        await sock.sendMessage(remoteJid, { text: '⚡ *Sedang memproses AI Video Upscaling di Cloud...*' }, { edit: statusMsg.key });

        let outputUrl;
        let processedBy = '';

        // Gunakan Promise.race untuk membatasi pemrosesan Hugging Face maksimal 15 detik agar tidak memblokir bot
        try {
            log.info('Attempting free Hugging Face video upscaler space...');
            
            const hfPromise = (async () => {
                const client = await Client.connect("https://lexiontik-video-upscaler.hf.space");
                const file = new File([buffer], "video.mp4", { type: "video/mp4" });
                
                log.info('Uploading video file natively to Hugging Face...');
                const uploadResult = await client.upload_files(client.config.root, [file]);
                
                if (uploadResult.error) {
                    throw new Error(`Upload error: ${uploadResult.error}`);
                }

                log.info('Triggering prediction on lexiontik/video_upscaler...');
                const result = await client.predict("/start_upscaler", [
                    { 
                        path: uploadResult.files[0], 
                        orig_name: "video.mp4", 
                        meta: { _type: "gradio.FileData" } 
                    },
                    "R-ESRGAN AnimeVideo", // upscaler_name
                    false,                // as_gif
                    1,                    // speed_factor
                    true,                 // half_precision
                    192,                  // tile
                    8,                    // tile_overlap
                    2.0,                  // upscaler_factor
                    8                     // workers
                ]);

                return result.data[0].url;
            })();

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Hugging Face Space Timeout (15s)')), 15000)
            );

            // Balapan antara HF upscaling dan 15-second timeout
            outputUrl = await Promise.race([hfPromise, timeoutPromise]);
            processedBy = 'R-ESRGAN Video (Free Hugging Face)';

        } catch (hfError) {
            log.error('Hugging Face video upscaler busy or timed out, trying Replicate fallback:', hfError.message);

            if (!replicateToken) {
                throw new Error(`Hugging Face error: ${hfError.message}. (Fallback Replicate dibatalkan karena REPLICATE_API_TOKEN kosong)`);
            }

            await sock.sendMessage(remoteJid, { text: '⚡ *Hugging Face sibuk/lambat, beralih ke Fallback Replicate (Sangat Cepat)...*' }, { edit: statusMsg.key });

            // Konversi video buffer ke Base64 Data URI
            const base64Video = `data:video/mp4;base64,${buffer.toString('base64')}`;
            const replicate = new Replicate({
                auth: replicateToken,
            });

            log.info('Running real-esrgan-video model on Replicate...');
            const output = await replicate.run(
                "lucataco/real-esrgan-video:3e56ce4b57863bd03048b42bc09bdd4db20d427cca5fde9d8ae4dc60e1bb4775",
                {
                    input: {
                        video_path: base64Video,
                        resolution: "HD",
                        model: "realesr-animevideov3"
                    }
                }
            );
            
            outputUrl = output;
            processedBy = 'Real-ESRGAN Video via Replicate';
        }

        if (!outputUrl) throw new Error('Gagal mendapatkan respon video dari Cloud AI.');

        await sock.sendMessage(remoteJid, { text: '📥 *Mengirim hasil video HD...*' }, { edit: statusMsg.key });

        // Kirim kembali video HD ke User
        await sock.sendMessage(remoteJid, { 
            video: { url: outputUrl },
            caption: `✅ *Video Berhasil Dibuat HD!*\n\n*Proses AI:* ${processedBy}\n*Server:* Cloud GPU`
        }, { quoted: m });

        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { text: '✅ Selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('HDVIDEO command error:', error.message);
        await react(sock, m, '❌');
        
        let errorMsg = error.message;
        if (error.message.includes('402') || error.message.toLowerCase().includes('credit') || error.message.toLowerCase().includes('payment')) {
            errorMsg = '💳 *Billing Replicate Habis!*\n\nLimit kuota Replicate gratis habis dan Hugging Face sedang mengalami error. Silakan isi ulang credit Replicate.';
        }
        
        await sock.sendMessage(remoteJid, { text: `❌ Gagal memproses video: ${errorMsg}` }, { quoted: m });
    }
};
