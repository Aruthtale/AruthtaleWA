import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { log } from '../utils/logger.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const voiceService = {
    /**
     * Convert text to speech and return the path to the audio file (Ogg/Opus for WhatsApp)
     * @param {string} text 
     * @returns {Promise<string>}
     */
    textToVoice: async (text) => {
        const outputPath = path.join(os.tmpdir(), `voice_${Date.now()}.ogg`);
        try {
            log.system('Converting text to voice...');
            
            // Using a public/free TTS engine (Google TTS)
            // For better quality, user should provide ElevenLabs API Key
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
            
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const tempMp3 = path.join(os.tmpdir(), `temp_${Date.now()}.mp3`);
            const writer = fs.createWriteStream(tempMp3);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Convert to Ogg/Opus (WhatsApp Voice Note format)
            // -c:a libopus -b:a 32k
            await execAsync(`ffmpeg -i "${tempMp3}" -c:a libopus -b:a 32k -vbr on "${outputPath}" -y`);
            
            if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
            
            return outputPath;
        } catch (error) {
            log.error('TTS Conversion failed:', error.message);
            throw error;
        }
    }
};
