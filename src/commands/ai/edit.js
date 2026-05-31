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
    const statusMsg = await sock.sendMessage(remoteJid, { text: '⏳ *Sedang mendownload media dari WhatsApp...*' }, { quoted: m });

    try {
        log.info('Step 1: Downloading WA Media...');
        const buffer = await downloadWAMedia(message);
        log.info(`Step 1 Complete: Buffer size ${buffer.length}`);
        const base64Image = buffer.toString('base64');

        await sock.sendMessage(remoteJid, { text: '🔍 *Sedang menganalisis wajah dan detail foto...*' }, { edit: statusMsg.key });

        log.info('Step 2: Asking Gemini to analyze style and prepare the description...');
        const analysisPrompt = `You are a master image-to-image prompt engineer.
Analyze this input image and the user's edit instruction: "${instruction}".

Your task is to write a highly detailed physical description of the person (gender, face, hair, eyes, skin tone, clothing, exact facial features, and any cute filters/stickers on their face), the background, colors, and layout of the original image.

Then, append the user's requested edit/addition: "${instruction}" seamlessly into that description.

Output ONLY the final detailed prompt to recreate this exact person/composition with the new edit. No intro, no markdown.`;

        const modifiedPrompt = await aiProvider.chat(analysisPrompt, { 
            image: base64Image,
            systemInstruction: "You are a master prompt engineer. You describe images with architectural precision so they can be recreated accurately."
        });

        const promptText = modifiedPrompt.text || modifiedPrompt;
        log.ai(`Step 2 Complete: Generated Detailed Prompt: ${promptText}`);

        await sock.sendMessage(remoteJid, { text: '⚡ *Sedang mengunggah foto ke Cloud AI...*' }, { edit: statusMsg.key });

        // Upload to Uguu.se to get a public URL for the Img2Img API
        log.info('Step 3: Uploading image to Uguu.se...');
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        formData.append('files[]', blob, 'image.jpg');

        const uploadRes = await fetch('https://uguu.se/upload?output=text', {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) throw new Error('Gagal mengunggah gambar ke cloud temp storage.');
        const imageUrl = (await uploadRes.text()).trim();
        log.info(`Step 3 Complete: Public Image URL: ${imageUrl}`);

        await sock.sendMessage(remoteJid, { text: '🎨 *Sedang memodifikasi gambar secara presisi...*' }, { edit: statusMsg.key });

        // 4. Generate New Image using Pollinations Img2Img Flow
        const strength = 0.35;
        const seed = Math.floor(Math.random() * 1000000);
        
        // Dynamically request horizontal/vertical dimensions based on the instruction
        const isHorizontal = instruction.toLowerCase().includes('landscape') || instruction.toLowerCase().includes('horizontal');
        const width = isHorizontal ? 1280 : 720;
        const height = isHorizontal ? 720 : 1280;

        const models = ['flux', 'flux-realism', 'turbo', 'default'];
        let imageBuffer;
        let usedModel = '';

        for (const model of models) {
            try {
                const modelParam = model === 'default' ? '' : `&model=${model}`;
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?image=${encodeURIComponent(imageUrl)}&width=${width}&height=${height}&seed=${seed}${modelParam}&strength=${strength}&prompt_strength=${strength}&nologo=true`;

                log.info(`Attempting Img2Img with model: ${model}...`);
                const response = await fetch(pollinationsUrl);
                
                if (response.ok) {
                    const arrayBuf = await response.arrayBuffer();
                    if (arrayBuf.byteLength > 10000) {
                        imageBuffer = Buffer.from(arrayBuf);
                        usedModel = model;
                        break;
                    }
                }
            } catch (err) {
                log.warn(`Img2Img model ${model} failed: ${err.message}`);
            }
        }

        if (!imageBuffer) {
            throw new Error('Semua model generator sedang sibuk. Silakan coba lagi nanti.');
        }

        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { 
            image: imageBuffer,
            caption: `✅ *Edit Selesai!*\n\n📝 *Instruksi:* ${instruction}\n✨ *Model:* ${usedModel.toUpperCase()} (Img2Img)`
        }, { quoted: m });

        await sock.sendMessage(remoteJid, { text: '✅ Selesai!', edit: statusMsg.key });

    } catch (error) {
        log.error('Edit command error:', error.message);
        await react(sock, m, '❌');
        const errorMsg = error.message.includes('timeout') ? 'Server generator sibuk, silakan coba lagi.' : error.message;
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengedit gambar: ${errorMsg}` }, { quoted: m });
    }
};
