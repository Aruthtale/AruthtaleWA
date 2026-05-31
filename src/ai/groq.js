import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

/**
 * Groq LPU Provider - Tier 2 (Fallback)
 * Ultra-fast inference using Groq's LPU technology
 * Free tier: ~30 req/min, ~14,400 req/day
 * OpenAI-compatible API
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const askGroq = async (prompt, model, options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';

    if (!settings.groqKey) {
        throw new Error('GROQ_API_KEY is not configured in .env');
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
        let response;
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            response = await fetch(GROQ_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.groqKey}`
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

            if (response.status === 429 && retries < maxRetries) {
                retries++;
                const waitTime = retries * 2000;
                log.warn(`[Groq] Rate limited (429). Retrying in ${waitTime}ms... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            break;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Groq API Error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (text) {
            return {
                text,
                usage: { totalTokenCount: data.usage?.total_tokens || 0 },
                provider: 'groq'
            };
        }
        throw new Error('Empty response from Groq');

    } catch (error) {
        log.error(`[Groq] ${model} Error:`, error.message);
        throw error;
    }
};
