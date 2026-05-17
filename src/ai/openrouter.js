import axios from 'axios';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

export const askOpenRouter = async (prompt, model = 'minimax/minimax-m2.5:free', options = {}) => {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';

    // Build messages array
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    // Map Gemini-style history to OpenAI-style messages
    history.forEach(msg => {
        const role = msg.role === 'model' ? 'assistant' : 'user';
        const content = msg.parts?.[0]?.text || '';
        if (content) messages.push({ role, content });
    });

    // Build user message (with optional image support)
    if (options.image) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${options.image}`
                    }
                }
            ]
        });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    const data = {
        model: model,
        messages: messages
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${settings.openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/antigravity-ai-bot',
                'X-Title': 'AI-WA-BOT'
            },
            timeout: 60000 // 60s timeout
        });

        const text = response.data.choices?.[0]?.message?.content || '';
        if (!text) throw new Error('Empty response from OpenRouter');

        return {
            text,
            usage: { totalTokenCount: response.data.usage?.total_tokens || 0 }
        };
    } catch (error) {
        log.error(`OpenRouter API Error (${model}):`, error.response?.data?.error?.message || error.message);
        throw error;
    }
};
