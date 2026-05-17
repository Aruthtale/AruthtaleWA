import { AI_MODELS, COMMAND_TASK_MAP } from './models.js';
import { askOpenRouter } from './openrouter.js';
import { askGemini, chatWithTools, askGeminiStreaming } from './gemini.js';
import { askKimi } from './kimi.js';
import { classifyIntent } from './classifier.js';
import { log } from '../utils/logger.js';
import { knowledgeService } from '../services/knowledge.js';

/**
 * Central AI Router - Routes requests to the best specialist model
 * Supports both Native (Google Studio) and OpenRouter providers
 */
export const aiRouter = {

    route: async (prompt, options = {}) => {
        // --- Audio always goes to Gemini Native ---
        if (options.audio) {
            log.ai('[Router] Audio detected → Gemini Native');
            const result = await askGemini(prompt, { ...options, model: 'gemini-2.0-flash-exp' });
            return { ...result, model: 'gemini-native-audio' };
        }

        let task = options.task || 'AUTO';
        if (task === 'AUTO') {
            task = classifyIntent(prompt);
        }

        // --- Auto-Context for Project Queries ---
        if (task === 'PROJECT') {
            try {
                log.ai('[Router] Auto-fetching context for "ai-wa-bot"...');
                const context = await knowledgeService.getProjectDetail('ai-wa-bot');
                prompt = `[CONTEXT PROYEK SAAT INI (ai-wa-bot)]\n${context}\n\nPERTANYAAN USER: ${prompt}`;
            } catch (err) {
                log.warn('Failed to auto-fetch project context:', err.message);
            }
        }

        if (options.image && task === 'GENERAL') {
            task = 'VISION';
        }

        const modelConfig = AI_MODELS[task] || AI_MODELS.GENERAL;
        const allModels = [modelConfig.primary, ...modelConfig.fallbacks];

        log.ai(`[Router] Task: ${task} (${modelConfig.name}) → Trying specialist chain`);

        let lastError = null;

        for (const config of allModels) {
            try {
                log.ai(`[Router] Trying ${config.provider.toUpperCase()}: ${config.id}`);

                let result;
                
                // --- Provider-specific History Formatting ---
                let history = options.history;
                if (config.provider !== 'native' && history && history.length > 0 && history[0].parts) {
                    // Convert Gemini Format (role/parts) to OpenAI Format (role/content)
                    history = history.map(m => ({
                        role: m.role === 'model' ? 'assistant' : 
                              m.role === 'system' ? 'system' : 'user',
                        content: m.parts[0].text
                    }));
                }

                if (config.provider === 'native') {
                    // Use Native Google Studio API
                    if ((task === 'AUTOMATION' || task === 'PROJECT') && options.isOwner) {
                        log.ai(`[Router] Using Tools for ${task} task (Owner Authorized)`);
                        result = await chatWithTools(prompt, { ...options, model: config.id });
                    } else if (task === 'AUTOMATION' || task === 'PROJECT') {
                        log.warn(`[Router] Security Block: Non-owner attempted ${task} task. Downgrading to GENERAL.`);
                        result = await askGemini(prompt, { ...options, model: config.id });
                    } else if (options.stream) {
                        log.ai(`[Router] Using Streaming for ${task} task`);
                        result = await askGeminiStreaming(prompt, { ...options, model: config.id });
                    } else {
                        result = await askGemini(prompt, { ...options, model: config.id });
                    }
                } else if (config.provider === 'kimi') {
                    // Use Native Moonshot/Kimi API
                    result = await askKimi(prompt, { ...options, history, model: config.id });
                } else {
                    // Use OpenRouter API
                    result = await askOpenRouter(prompt, config.id, {
                        history: history,
                        systemInstruction: options.systemInstruction,
                        image: options.image
                    });
                }

                if (result.text && !result.text.includes('[Error]')) {
                    log.ai(`[Router] ✅ Success: ${config.id}`);
                    return { ...result, model: config.id };
                }

                throw new Error('Empty or error response');
            } catch (error) {
                lastError = error;
                const status = error.response?.status || error.message;
                log.warn(`[Router] ❌ ${config.id} failed: ${status}`);
            }
        }

        // --- Ultimate Safety Net ---
        log.ai('[Router] All specialists failed → Gemini Native Safety Net');
        try {
            const result = await askGemini(prompt, { ...options, model: 'gemini-2.0-flash-exp' });
            return { ...result, model: 'gemini-native-fallback' };
        } catch (geminiError) {
            log.error('[Router] CRITICAL FAILURE', geminiError.message);
            return {
                text: `❌ *Semua AI Provider sedang tidak tersedia.*\nCoba lagi nanti.`,
                usage: { totalTokenCount: 0 },
                model: 'none'
            };
        }
    }
};

export default aiRouter;
