import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

/**
 * Kimi (Moonshot AI) Native Provider
 * Endpoint: https://api.moonshot.cn/v1
 */
export const askKimi = async (prompt, options = {}) => {
    const url = 'https://api.moonshot.ai/v1/chat/completions';
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || 'Kamu adalah Aruthtale, asisten AI yang cerdas dan teknis.';
    const model = options.model || 'moonshot-v1-8k'; // default model

    if (!settings.kimiKey) {
        throw new Error('KIMI_API_KEY is not configured in .env');
    }

    try {
        const messages = [
            { role: 'system', content: systemInstruction },
            ...history,
            { role: 'user', content: prompt }
        ];

        let response;
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.kimiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: options.temperature || 0.3,
                })
            });

            if (response.status === 429 && retries < maxRetries) {
                retries++;
                const waitTime = retries * 2000;
                log.warn(`[Kimi] Rate limited (429). Retrying in ${waitTime}ms... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            break;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Kimi API Error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (text) {
            return {
                text,
                usage: data.usage || { total_tokens: 0 }
            };
        }
        throw new Error('Empty response from Kimi');

    } catch (error) {
        log.error('[Kimi] Error:', error.message);
        throw error;
    }
};
