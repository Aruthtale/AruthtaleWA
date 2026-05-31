import { downloadMediaMessage } from '@whiskeysockets/baileys';
import Replicate from 'replicate';
import { Client } from '@gradio/client';
import { File } from 'node:buffer';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';

export const help = `🖼️ *Bantuan !hd*

Meningkatkan resolusi foto menjadi HD / Tajam menggunakan Cloud AI.

*Format:* 
- Balas foto dengan \`!hd\` (untuk foto umum/pemandangan/kartun/anime)
- Balas foto dengan \`!hd face\` (khusus foto dengan objek wajah manusia agar sangat detail)

*Akses:* Authorized Users (Owner + Verified Users)
*Cooldown:* 30 detik`;

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // Mendeteksi gambar dari berbagai jenis payload (termasuk ViewOnce)
    const hasImage = m.message?.imageMessage || 
                     m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                     m.message?.viewOnceMessage?.message?.imageMessage ||
                     m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message?.imageMessage;

    if (!hasImage) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Balas foto yang ingin di-HD dengan perintah *!hd* atau *!hd face*' 
        }, { quoted: m });
    }

    const mode = args[0]?.toLowerCase() === 'face' ? 'face' : 'general';

    try {
        log.wa(`Processing HD upscaling (${mode}) for: ${remoteJid}`);
        await react(sock, m, '⏳');
        const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mendownload media dari WhatsApp...*' }, { quoted: m });

        // Tentukan message object yang akan didownload
        const downloadMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage ? 
            { message: m.message.extendedTextMessage.contextInfo.quotedMessage } : m;

        // Download image buffer dari WhatsApp
        const buffer = await downloadMediaMessage(
            downloadMessage,
            'buffer',
            {},
            { logger: log }
        );

        if (!buffer) throw new Error('Gagal mendownload media dari WhatsApp.');

        await sock.sendMessage(remoteJid, { text: '⚡ *Sedang memproses AI Upscaling di Cloud...*' }, { edit: statusMsg.key });

        let outputUrl;
        let processedBy = '';

        try {
            // --- HUGGING FACE GRADIO CLOUD (FREE PRIMARY ROUTE) ---
            if (mode === 'face') {
                log.info('Connecting to CodeFormer Space on Hugging Face...');
                const client = await Client.connect("https://sczhou-codeformer.hf.space");
                
                const file = new File([buffer], "image.png", { type: "image/png" });
                log.info('Uploading file natively to CodeFormer Space...');
                const uploadResult = await client.upload_files(client.config.root, [file]);
                
                if (uploadResult.error) {
                    throw new Error(`Upload error: ${uploadResult.error}`);
                }

                log.info('Triggering prediction on CodeFormer...');
                const result = await client.predict("/inference", [
                    { 
                        path: uploadResult.files[0], 
                        orig_name: "image.png", 
                        meta: { _type: "gradio.FileData" } 
                    },
                    true,  // Pre_Face_Align
                    true,  // Background_Enhance
                    true,  // Face_Upsample
                    2,     // Rescaling_Factor
                    0.5    // Codeformer_Fidelity
                ]);

                outputUrl = result.data[0].url;
                processedBy = 'CodeFormer (Face Restoration)';
            } else {
                log.info('Connecting to Real-ESRGAN Space on Hugging Face...');
                const client = await Client.connect("https://nick088-real-esrgan-pytorch.hf.space");
                
                const file = new File([buffer], "image.png", { type: "image/png" });
                log.info('Uploading file natively to Real-ESRGAN Space...');
                const uploadResult = await client.upload_files(client.config.root, [file]);
                
                if (uploadResult.error) {
                    throw new Error(`Upload error: ${uploadResult.error}`);
                }

                log.info('Triggering prediction on Real-ESRGAN...');
                const result = await client.predict("/predict", [
                    { 
                        path: uploadResult.files[0], 
                        orig_name: "image.png", 
                        meta: { _type: "gradio.FileData" } 
                    },
                    4 // Upscale factor (4x)
                ]);

                outputUrl = result.data[0].url;
                processedBy = 'Real-ESRGAN (Super Resolution)';
            }
        } catch (hfError) {
            log.error('Hugging Face processing failed, attempting Replicate fallback:', hfError.message);

            // --- REPLICATE CLOUD (ROBUST FALLBACK ROUTE) ---
            if (!replicateToken) {
                throw new Error(`Hugging Face error: ${hfError.message}. (Fallback Replicate dibatalkan karena REPLICATE_API_TOKEN kosong)`);
            }

            await sock.sendMessage(remoteJid, { text: '⚡ *Hugging Face sibuk, beralih ke Fallback Replicate (A100 GPU)...*' }, { edit: statusMsg.key });

            const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
            const replicate = new Replicate({
                auth: replicateToken,
            });

            if (mode === 'face') {
                log.info('Running CodeFormer model on Replicate fallback...');
                const output = await replicate.run(
                    "sczhou/codeformer",
                    {
                        input: {
                            image: base64Image,
                            codeformer_fidelity: 0.7,
                            background_enhance: true,
                            face_upsample: true,
                            upscale: 2
                        }
                    }
                );
                outputUrl = output;
                processedBy = 'CodeFormer via Replicate';
            } else {
                log.info('Running Real-ESRGAN model on Replicate fallback...');
                const output = await replicate.run(
                    "nightmareai/real-esrgan",
                    {
                        input: {
                            image: base64Image,
                            scale: 2,
                            face_enhance: false
                        }
                    }
                );
                outputUrl = output;
                processedBy = 'Real-ESRGAN via Replicate';
            }
        }

        if (!outputUrl) throw new Error('Gagal mendapatkan respon dari Cloud AI.');

        await sock.sendMessage(remoteJid, { text: '📥 *Mengirim hasil gambar HD...*' }, { edit: statusMsg.key });

        // Kirim kembali gambar HD ke User
        await sock.sendMessage(remoteJid, { 
            image: { url: outputUrl },
            caption: `✅ *Foto Berhasil Dibuat HD!*\n\n*Proses AI:* ${processedBy}\n*Server:* Hugging Face Cloud`
        }, { quoted: m });

        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { text: '✅ Selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('HD command error:', error.message);
        await react(sock, m, '❌');
        
        let errorMsg = error.message;
        if (error.message.includes('402') || error.message.toLowerCase().includes('credit') || error.message.toLowerCase().includes('payment')) {
            errorMsg = '💳 *Billing Replicate Habis!*\n\nLimit kuota Replicate gratis habis dan Hugging Face sedang mengalami error. Silakan hubungi Owner untuk mengisi ulang credit Replicate.';
        }
        
        await sock.sendMessage(remoteJid, { text: `❌ Gagal memproses gambar: ${errorMsg}` }, { quoted: m });
    }
};
