import react from '../../utils/react.js';
import { downloadWAMedia } from '../../utils/waUtils.js';
import { aiProvider } from '../../ai/provider.js';
import { log } from '../../utils/logger.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const instruction = args.join(' ');

    if (!instruction) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Sertakan instruksi edit.\nContoh: Balas gambar dengan `!edit buat dia pakai kacamata hitam`' 
        }, { quoted: m });
    }

    // 1. Get the image (either from current message or quoted message)
    const message = m.message?.imageMessage ? m.message : m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = message?.imageMessage;

    if (!isImage) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Silakan kirim gambar dengan caption `!edit ...` atau balas sebuah gambar.' 
        }, { quoted: m });
    }

    await react(sock, m, '⏳');
    await sock.sendMessage(remoteJid, { text: '🔍 *Sedang menganalisis gambar dan instruksi...*' }, { quoted: m });

    try {
        log.info('Step 1: Downloading WA Media...');
        const buffer = await downloadWAMedia(message);
        log.info(`Step 1 Complete: Buffer size ${buffer.length}`);
        const base64Image = buffer.toString('base64');

        log.info('Step 2: Asking Gemini to reverse-engineer and create prompt...');
        const analysisPrompt = `Reverse-engineer this image into a professional generation prompt. 
User Instruction: "${instruction}".
Requirements:
1. Preserve the exact COLLAGE/NEWSPAPER layout (specific photo placements, columns, headers).
2. Maintain the scrapbook/vintage aesthetic.
3. Optimize for 9:16 vertical wallpaper.
4. Use high-end keywords (8k, hyper-detailed, Flux Pro, professional editorial design).
Output ONLY the final prompt.`;

        const modifiedPrompt = await aiProvider.chat(analysisPrompt, { 
            image: base64Image,
            systemInstruction: "You are a master prompt engineer for High-End AI Generators. Your task is to describe images with architectural precision so they can be recreated accurately."
        });

        const promptText = modifiedPrompt.text || modifiedPrompt;
        log.ai(`Step 2 Complete: Generated Edit Prompt: ${promptText}`);

        // 4. Generate New Image (with fallback)
        await sock.sendMessage(remoteJid, { text: '🎨 *Melukis ulang imajinasimu...*\n_Memproses dengan Flux / Pollinations..._' }, { quoted: m });
        
        const models = ['flux', 'flux-realism', 'turbo', 'sana', 'default'];
        let imageBuffer;
        let usedModel = '';

        for (const model of models) {
            try {
                const seed = Math.floor(Math.random() * 1000000);
                const modelParam = model === 'default' ? '' : `&model=${model}`;
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=720&height=1280&seed=${seed}${modelParam}&nologo=true`;

                log.info(`Attempting edit with model: ${model}...`);
                const axios = (await import('axios')).default;
                const response = await axios.get(imageUrl, { 
                    responseType: 'arraybuffer',
                    timeout: 60000 
                });
                
                if (response.status === 200 && response.data.length > 10000) {
                    imageBuffer = Buffer.from(response.data);
                    usedModel = model;
                    break;
                }
            } catch (err) {
                log.warn(`Edit model ${model} failed: ${err.message}`);
            }
        }

        if (!imageBuffer) {
            throw new Error('Semua model generator sedang sibuk. Silakan coba lagi nanti.');
        }

        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { 
            image: imageBuffer,
            caption: `✅ *Edit Selesai!*\n\n📝 *Instruksi:* ${instruction}\n✨ *Model:* ${usedModel.toUpperCase()}`
        }, { quoted: m });

    } catch (error) {
        log.error('Edit command error:', error.message);
        const errorMsg = error.message.includes('timeout') ? 'Server generator sibuk, silakan coba lagi.' : error.message;
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengedit gambar: ${errorMsg}` }, { quoted: m });
    }
};
