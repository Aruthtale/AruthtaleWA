import axios from 'axios';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { fsTools, toolDefinitions } from '../utils/fsTools.js';

const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview'
];

/**
 * Main Chat Function
 */
export const askGemini = async (prompt, options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';
    const requestedModel = options.model || null;
    let lastError = null;

    const modelsToTry = requestedModel
        ? [requestedModel, ...GEMINI_MODELS.filter(m => m !== requestedModel)]
        : GEMINI_MODELS;

    for (const model of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiKey}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            let parts = [{ text: prompt }];
            if (options.image) {
                parts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: options.image
                    }
                });
            }
            if (options.audio) {
                parts.push({
                    inlineData: {
                        mimeType: options.audio.mimeType,
                        data: options.audio.data
                    }
                });
            }

            let response;
            let retries = 0;
            const maxRetries = 2;

            while (retries <= maxRetries) {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: history.length > 0 ? history : [{ parts: parts }],
                        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
                    }),
                    signal: controller.signal
                });

                if (response.status === 429 && retries < maxRetries) {
                    retries++;
                    const waitTime = retries * 2000;
                    log.warn(`[Gemini] Rate limited (429). Retrying in ${waitTime}ms... (${retries}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                break;
            }

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API Error (${response.status}): ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                return {
                    text,
                    usage: data.usageMetadata || { totalTokenCount: 0 }
                };
            }
            throw new Error('Empty response from Gemini');

        } catch (error) {
            lastError = error;
            log.warn(`[Gemini] ${model} failed: ${error.message}`);
        }
    }

    throw lastError || new Error('All Gemini models failed');
};

/**
 * Streaming Chat Function
 */
export const askGeminiStreaming = async (prompt, options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';
    const model = options.model || GEMINI_MODELS[0];
    const onChunk = options.onChunk || (() => {});

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${settings.geminiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: history.length > 0 ? history : [{ parts: [{ text: prompt }] }],
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
            })
        });

        if (!response.ok) throw new Error(`Gemini Streaming Error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let usage = { totalTokenCount: 0 };
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Simpan baris yang belum lengkap ke buffer

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
                
                try {
                    const data = JSON.parse(trimmedLine.substring(6));
                    const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textChunk) {
                        fullText += textChunk;
                        onChunk(fullText);
                    }
                    if (data.usageMetadata) usage = data.usageMetadata;
                } catch (e) {
                    // log.warn('[Gemini Streaming] Partial JSON or parsing error:', e.message);
                }
            }
        }

        return { text: fullText, usage };

    } catch (error) {
        log.error('[Gemini Streaming] Failed:', error.message);
        throw error;
    }
};

const embeddingCache = new Map();

/**
 * Embed Text for Vector Search
 */
export const embedText = async (text) => {
    if (!text) return null;
    const cacheKey = text.trim();
    if (embeddingCache.has(cacheKey)) return embeddingCache.get(cacheKey);

    try {
        const model = "gemini-embedding-2"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${settings.geminiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text }] }
            })
        });

        if (!response.ok) {
            throw new Error(`Embedding Error: ${response.status}`);
        }
        const data = await response.json();
        const embedding = data.embedding.values;
        
        // Cache it
        if (embeddingCache.size > 500) embeddingCache.delete(embeddingCache.keys().next().value);
        embeddingCache.set(cacheKey, embedding);

        return embedding;
    } catch (error) {
        log.error('[Gemini Embed] Failed:', error.message);
        throw error;
    }
};

/**
 * Chat with function calling (Tools)
 */
export const chatWithTools = async (prompt, options = {}) => {
    const history = options.history || [];
    const systemInstruction = options.systemInstruction || '';
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS[0]}:generateContent?key=${settings.geminiKey}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: history.length > 0 ? history : [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                tools: [
                    { function_declarations: toolDefinitions },
                    { google_search_retrieval: {} }
                ]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Gemini Tools Error: ${JSON.stringify(err)}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const functionCall = candidate?.content?.parts?.find(p => p.functionCall);

        if (functionCall) {
            const { name, args } = functionCall.functionCall;
            log.ai(`[Gemini Tools] Calling: ${name}`, args);
            
            const toolResult = await fsTools[name](args);
            
            const followUpResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        ...history,
                        { role: 'user', parts: [{ text: prompt }] },
                        candidate.content,
                        {
                            role: 'function',
                            parts: [{
                                functionResponse: {
                                    name,
                                    response: { content: toolResult }
                                }
                            }]
                        }
                    ],
                    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
                })
            });

            const finalData = await followUpResponse.json();
            return {
                text: finalData.candidates?.[0]?.content?.parts?.[0]?.text || 'Gagal memproses hasil alat.',
                usage: finalData.usageMetadata || { totalTokenCount: 0 }
            };
        }

        return {
            text: candidate?.content?.parts?.[0]?.text || 'No response',
            usage: data.usageMetadata || { totalTokenCount: 0 }
        };

    } catch (error) {
        log.error('[Gemini Tools] Failed:', error.message);
        return { text: `❌ Gagal memanggil fungsi: ${error.message}`, usage: { totalTokenCount: 0 } };
    }
};
