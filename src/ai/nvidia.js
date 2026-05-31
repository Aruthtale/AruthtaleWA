import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

/**
 * NVIDIA NIM Provider - Tier 1 (Primary)
 * OpenAI-compatible API at integrate.api.nvidia.com
 * Free prototyping tier, ~40 req/min
 */

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export const askNvidia = async (prompt, model, options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';

    if (!settings.nvidiaKey) {
        throw new Error('NVIDIA_API_KEY is not configured in .env');
    }

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    // Add conversation history
    if (history.length > 0) {
        history.forEach(msg => {
            if (msg.parts) {
                // Convert Gemini format
                messages.push({
                    role: msg.role === 'model' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
                    content: msg.parts[0].text
                });
            } else {
                messages.push(msg);
            }
        });
    }

    // Build user message with optional image
    if (options.image) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${options.image}` }
                }
            ]
        });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout — router handles failover

        const response = await fetch(NVIDIA_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.nvidiaKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: options.temperature || 0.3,
                max_tokens: options.maxTokens || 4096,
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`NVIDIA NIM Error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (text) {
            return {
                text,
                usage: { totalTokenCount: data.usage?.total_tokens || 0 },
                provider: 'nvidia'
            };
        }
        throw new Error('Empty response from NVIDIA NIM');

    } catch (error) {
        log.error(`[NVIDIA] ${model} Error:`, error.message);
        throw error;
    }
};
