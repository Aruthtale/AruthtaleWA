import axios from 'axios';
import { log } from '../../utils/logger.js';
import { react } from '../../utils/react.js';
import { aiProvider } from '../../ai/provider.js';
import { usageService } from '../../services/usageService.js';

export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    let prompt = args.join(' ');

    if (!prompt) {
        return await sock.sendMessage(remoteJid, { 
            text: '❌ Sertakan deskripsi gambar yang ingin dibuat.\nContoh: `!gen seorang astronot di atas kuda di bulan, gaya digital art`' 
        }, { quoted: m });
    }

    await react(sock, m, '⏳');
    await sock.sendMessage(remoteJid, { text: '🎨 *Sedang melukis imajinasimu, mohon tunggu...*' }, { quoted: m });

    try {
        // 1. Terjemahkan prompt ke Bahasa Inggris agar hasil Pollinations lebih akurat
        log.ai(`Translating prompt: ${prompt}`);
        const translationPrompt = `Translate this image generation prompt to English. Be descriptive but concise. If it's already in English, refine it for better AI image generation. Output ONLY the English prompt.\nPrompt: "${prompt}"`;
        
        const englishPrompt = await aiProvider.chat(translationPrompt, { 
            systemInstruction: "You are a professional prompt engineer. Your task is to translate and optimize prompts for AI image generators (Flux/Stable Diffusion)."
        });

        const promptText = englishPrompt.text || englishPrompt;
        const finalPrompt = promptText.replace(/^"|"$/g, '').trim();
        log.ai(`Optimized English Prompt: ${finalPrompt}`);

        // Daftar model yang akan dicoba jika gagal (v6.0 Update)
        const models = ['flux', 'flux-realism', 'flux-pro', 'turbo', 'sana', 'default'];
        let lastError;
        let imageBuffer;
        let usedModel = '';

        for (const model of models) {
            try {
                const seed = Math.floor(Math.random() * 1000000);
                const modelParam = model === 'default' ? '' : `&model=${model}`;
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}${modelParam}&nologo=true`;
                
                log.ai(`Attempting image generation with model: ${model}...`);
                
                const response = await axios.get(imageUrl, { 
                    responseType: 'arraybuffer', 
                    timeout: 45000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                if (response.status === 200 && response.data.length > 20000) {
                    imageBuffer = Buffer.from(response.data);
                    usedModel = model;
                    break; // Success!
                } else {
                    throw new Error(`Invalid response or image too small (${response.data.length} bytes)`);
                }
            } catch (err) {
                log.warn(`Model ${model} failed: ${err.message}`);
                lastError = err;
                // Continue to next model
            }
        }

        if (!imageBuffer) {
            throw lastError || new Error('All models failed to generate image.');
        }

        // Kita kirim sebagai gambar
        await react(sock, m, '✅');
        await sock.sendMessage(remoteJid, { 
            image: imageBuffer,
            caption: `🎨 *AI Generated Image*\n\n📌 *Prompt:* ${prompt}\n✨ *Model:* ${usedModel.toUpperCase()} / Pollinations`
        }, { quoted: m });

        // Log Usage
        const realSender = m.key.participant || m.key.remoteJid;
        const senderNumber = realSender.split('@')[0];
        await usageService.logUsage(senderNumber, 'IMAGE_GEN', 1);

        log.success(`Image generated successfully using ${usedModel}`);
    } catch (error) {
        log.error('Image generation error:', error.message);
        await react(sock, m, '❌');
        await sock.sendMessage(remoteJid, { 
            text: `⚠️ *Gagal membuat gambar:* ${error.message}\n\nLayanan sedang sibuk atau deskripsi Anda melanggar kebijakan konten. Coba gunakan prompt yang lebih sederhana.` 
        }, { quoted: m });
    }
};
