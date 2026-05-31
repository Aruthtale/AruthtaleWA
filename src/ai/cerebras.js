import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

/**
 * Cerebras Provider - Tier 3 (Emergency Backup)
 * Ultra-fast inference using Cerebras Wafer-Scale Engine
 * Free tier: ~1M tokens/day, no credit card required
 * OpenAI-compatible API
 */

const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1/chat/completions';

export const askCerebras = async (prompt, model = 'llama-3.3-70b', options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';

    if (!settings.cerebrasKey) {
        throw new Error('CEREBRAS_API_KEY is not configured in .env');
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

    messages.push({ role: 'user', content: prompt });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(CEREBRAS_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.cerebrasKey}`
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
            throw new Error(`Cerebras API Error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (text) {
            return {
                text,
                usage: { totalTokenCount: data.usage?.total_tokens || 0 },
                provider: 'cerebras'
            };
        }
        throw new Error('Empty response from Cerebras');

    } catch (error) {
        log.error(`[Cerebras] ${model} Error:`, error.message);
        throw error;
    }
};
