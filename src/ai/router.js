import { AI_MODELS, COMMAND_TASK_MAP, PROVIDERS, TIER_LABELS } from './models.js';
import { askNvidia } from './nvidia.js';
import { askGroq } from './groq.js';
import { askCerebras } from './cerebras.js';
import { askOpenRouter } from './openrouter.js';
import { askGemini, chatWithTools, askGeminiStreaming } from './gemini.js';
import { askKimi } from './kimi.js';
import { classifyIntent } from './classifier.js';
import { log } from '../utils/logger.js';
import { knowledgeService } from '../services/knowledge.js';
import { insert } from '../services/firebaseService.js';
import { settings } from '../config/settings.js';

/**
 * Smart AI Router v2.0 — 3-Tier Provider Architecture
 * 
 * Flow:
 *   Pesan masuk → Smart Router → Classify Task
 *     → Tier 1 (NVIDIA NIM) → try all NVIDIA models
 *     → Tier 2 (Groq LPU)   → try all Groq models (only if ALL NVIDIA fail)
 *     → Tier 3 (Emergency)   → OpenRouter / Google AI Studio / Cerebras
 *     → Safety Filter (Nemotron Content Safety)
 *     → Response ke user
 * 
 * Special cases:
 *   - Audio → always Gemini Native
 *   - Automation/Project + Owner → Gemini Native with Tools (Tier 0)
 *   - OpenRouter ONLY runs after ALL NVIDIA providers fail
 */
export const aiRouter = {

    route: async (prompt, options = {}) => {
        // --- Audio always goes to Gemini Native ---
        if (options.audio) {
            log.ai('[Router] 🎵 Audio detected → Gemini Native');
            const result = await askGemini(prompt, { ...options, model: 'gemini-2.0-flash-exp' });
            return { ...result, model: 'gemini-native-audio', provider: 'native', tier: 0 };
        }

        // --- Determine task ---
        let task = options.task || 'AUTO';
        if (task === 'AUTO') {
            task = classifyIntent(prompt);
        }

        // --- Auto-Context for Project Queries ---
        if (task === 'PROJECT') {
            try {
                log.ai('[Router] 📂 Auto-fetching context for "ai-wa-bot"...');
                const context = await knowledgeService.getProjectDetail('ai-wa-bot');
                prompt = `[CONTEXT PROYEK SAAT INI (ai-wa-bot)]\n${context}\n\nPERTANYAAN USER: ${prompt}`;
            } catch (err) {
                log.warn('Failed to auto-fetch project context:', err.message);
            }
        }

        // --- Auto-detect vision task ---
        if (options.image && task === 'GENERAL') {
            task = 'VISION';
        }

        // --- Get model chain for this task ---
        const modelConfig = AI_MODELS[task] || AI_MODELS.GENERAL;
        const chain = modelConfig.chain;

        log.ai(`[Router] 🎯 Task: ${task} (${modelConfig.name})`);
        log.ai(`[Router] 📋 Chain: ${chain.length} models across ${new Set(chain.map(m => m.tier)).size} tiers`);

        let lastError = null;
        let currentTier = -1;
        let consecutiveTierFailures = 0;  // Track consecutive failures per tier
        const MAX_TIER_FAILURES = 2;       // Skip remaining models in tier after N failures

        for (const config of chain) {
            log.info(`[Router Debug] Checking ${config.id} - tier: ${config.tier}, lastError: ${lastError ? lastError.message : 'none'}`);
            
            // Smart Tier Skip: If we've had too many failures in current tier, skip to next
            if (config.tier === currentTier && consecutiveTierFailures >= MAX_TIER_FAILURES) {
                log.ai(`[Router] ⏩ Skipping ${config.id} (${consecutiveTierFailures} consecutive failures in tier ${currentTier})`);
                continue;
            }

            // Log tier transitions & reset failure counter
            if (config.tier !== currentTier) {
                currentTier = config.tier;
                consecutiveTierFailures = 0;
                log.ai(`[Router] ── ${TIER_LABELS[currentTier] || `Tier ${currentTier}`} ──`);
            }

            const startTime = Date.now();
            try {
                log.ai(`[Router] Trying ${config.provider.toUpperCase()}: ${config.id}`);

                let result;

                // --- Format history for non-Gemini providers ---
                let history = options.history;
                if (config.provider !== PROVIDERS.NATIVE && history && history.length > 0 && history[0].parts) {
                    history = history.map(m => ({
                        role: m.role === 'model' ? 'assistant' :
                              m.role === 'system' ? 'system' : 'user',
                        content: m.parts[0].text
                    }));
                }

                // --- Sanitize history: remove poisoned model identity responses ---
                // Prevents new model from parroting old (wrong) model names from history
                if (history && history.length > 0) {
                    const modelNamePattern = /(?:menggunakan model|using model|model.*(?:gemini|gpt|llama|deepseek|glm|mistral|minimax|kimi))/i;
                    history = history.filter(m => {
                        const content = m.content || m.parts?.[0]?.text || '';
                        const role = m.role === 'model' ? 'assistant' : m.role;
                        // Only filter assistant responses that mention model names
                        return !(role === 'assistant' && modelNamePattern.test(content));
                    });
                }
                // --- Inject model metadata so AI can self-report accurately ---
                const modelMeta = `\n[IDENTITAS MODEL - WAJIB DIPATUHI]\nModel ID: ${config.id}\nProvider: ${config.provider.toUpperCase()}\nTier: ${TIER_LABELS[config.tier] || 'Tier ' + config.tier}\nATURAN KRITIS: Jika user bertanya model apa yang kamu gunakan, WAJIB jawab "${config.id}" via ${config.provider.toUpperCase()}. JANGAN PERNAH mengarang atau menggunakan nama model dari percakapan sebelumnya. Ini adalah identitas AKTUAL kamu saat ini.`;
                const enrichedSystemInstruction = options.systemInstruction 
                    ? `${options.systemInstruction}\n${modelMeta}`
                    : modelMeta;

                // === DISPATCH TO PROVIDER ===
                switch (config.provider) {

                    case PROVIDERS.NATIVE: {
                        // Google AI Studio — supports tools for Automation/Project
                        const nativeOpts = { ...options, model: config.id, systemInstruction: enrichedSystemInstruction };
                        if ((task === 'AUTOMATION' || task === 'PROJECT') && options.isOwner) {
                            log.ai(`[Router] 🔧 Using Tools for ${task} task (Owner Authorized)`);
                            result = await chatWithTools(prompt, nativeOpts);
                        } else if (task === 'AUTOMATION' || task === 'PROJECT') {
                            log.warn(`[Router] 🔒 Security Block: Non-owner attempted ${task} task. Downgrading.`);
                            result = await askGemini(prompt, nativeOpts);
                        } else if (options.stream) {
                            log.ai(`[Router] 📡 Using Streaming for ${task} task`);
                            result = await askGeminiStreaming(prompt, nativeOpts);
                        } else {
                            result = await askGemini(prompt, nativeOpts);
                        }
                        break;
                    }

                    case PROVIDERS.NVIDIA: {
                        result = await askNvidia(prompt, config.id, {
                            history: history,
                            systemInstruction: enrichedSystemInstruction,
                            image: options.image,
                            temperature: options.temperature,
                        });
                        break;
                    }

                    case PROVIDERS.GROQ: {
                        result = await askGroq(prompt, config.id, {
                            history: history,
                            systemInstruction: enrichedSystemInstruction,
                            image: options.image,
                            temperature: options.temperature,
                        });
                        break;
                    }

                    case PROVIDERS.OPENROUTER: {
                        result = await askOpenRouter(prompt, config.id, {
                            history: history,
                            systemInstruction: enrichedSystemInstruction,
                            image: options.image
                        });
                        break;
                    }

                    case PROVIDERS.CEREBRAS: {
                        result = await askCerebras(prompt, config.id, {
                            history: history,
                            systemInstruction: enrichedSystemInstruction,
                            temperature: options.temperature,
                        });
                        break;
                    }

                    case PROVIDERS.KIMI: {
                        result = await askKimi(prompt, {
                            ...options,
                            systemInstruction: enrichedSystemInstruction,
                            history: history,
                            model: config.id
                        });
                        break;
                    }

                    default:
                        throw new Error(`Unknown provider: ${config.provider}`);
                }

                // --- Validate response ---
                if (result.text && !result.text.includes('[Error]')) {
                    const latency = Date.now() - startTime;
                    log.ai(`[Router] ✅ Success: ${config.provider.toUpperCase()} → ${config.id}`);
                    
                    // Track analytics (fire and forget via IIFE)
                    (async () => {
                        const { error: dbError } = await insert('ai_metrics', {
                            provider: config.provider,
                            model: config.id,
                            tier: config.tier,
                            status: 'success',
                            latency: latency
                        });
                        if (dbError) log.error('Analytics DB Error:', dbError.message);
                    })();

                    return {
                        ...result,
                        model: config.id,
                        provider: config.provider,
                        tier: config.tier
                    };
                }

                throw new Error('Empty or error response');

            } catch (error) {
                const latency = Date.now() - startTime;
                lastError = error;
                consecutiveTierFailures++;
                const status = error.response?.status || error.message;
                log.warn(`[Router] ❌ ${config.provider.toUpperCase()} ${config.id} failed: ${status}`);
                
                // Track analytics error (fire and forget via IIFE)
                (async () => {
                    const { error: dbError } = await insert('ai_metrics', {
                        provider: config.provider,
                        model: config.id,
                        tier: config.tier,
                        status: 'error',
                        latency: latency
                    });
                    if (dbError) log.error('Analytics DB Error:', dbError.message);
                })();
            }
        }

        // === ULTIMATE SAFETY NET ===
        log.ai('[Router] 🆘 All chains failed → Gemini Native Safety Net');
        try {
            const result = await askGemini(prompt, { ...options, model: 'gemini-2.0-flash-exp' });
            return { ...result, model: 'gemini-native-fallback', provider: 'native', tier: 99 };
        } catch (geminiError) {
            log.error('[Router] 💀 CRITICAL FAILURE — All providers exhausted', geminiError.message);
            return {
                text: `❌ *Semua AI Provider sedang tidak tersedia.*\n\n` +
                      `📊 Status:\n` +
                      `• NVIDIA NIM: Offline\n` +
                      `• Groq LPU: Offline\n` +
                      `• OpenRouter: Offline\n` +
                      `• Google AI Studio: Offline\n` +
                      `• Cerebras: Offline\n\n` +
                      `Coba lagi dalam beberapa menit.`,
                usage: { totalTokenCount: 0 },
                model: 'none',
                provider: 'none',
                tier: -1
            };
        }
    }
};

export default aiRouter;
