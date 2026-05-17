/**
 * AI Model Registry - Centralized model definitions
 * Native: Google AI Studio (Free tier)
 * Kimi: Moonshot AI (Free tokens via native API)
 * OpenRouter: Other models
 */

export const AI_MODELS = {
    // === Frontend & UI/UX Development ===
    FRONTEND: {
        name: 'Frontend & UI/UX',
        primary: { id: 'gemini-3-flash-preview', provider: 'native' },
        fallbacks: [
            { id: 'gemini-2.5-flash', provider: 'native' },
            { id: 'minimax/minimax-m2.5:free', provider: 'openrouter' }
        ]
    },
    VISION: {
        name: 'Vision & Image',
        primary: { id: 'gemini-3.1-flash-image-preview', provider: 'native' },
        fallbacks: [
            { id: 'nano-banana-pro-preview', provider: 'native' },
            { id: 'gemini-3-flash-preview', provider: 'native' }
        ]
    },
    CSS: {
        name: 'CSS & Boilerplate',
        primary: { id: 'gemini-3-flash-preview', provider: 'native' },
        fallbacks: [
            { id: 'minimax/minimax-m2.5:free', provider: 'openrouter' }
        ]
    },

    // === Backend & Logic Engineering ===
    BACKEND: {
        name: 'Kimi Backend Specialist',
        primary: { id: 'moonshot-v1-8k', provider: 'kimi' }, // Ganti ke moonshot-v1-32k jika perlu
        fallbacks: [
            { id: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter' },
            { id: 'z-ai/glm-4.5-air:free', provider: 'openrouter' }
        ]
    },
    CODE: {
        name: 'Pure Coding',
        primary: { id: 'z-ai/glm-4.5-air:free', provider: 'openrouter' },
        fallbacks: [
            { id: 'moonshot-v1-8k', provider: 'kimi' },
            { id: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter' }
        ]
    },

    // === Debugging & Technical Support ===
    DEBUG: {
        name: 'Deep Thinking Debug',
        primary: { id: 'liquid/lfm-2.5-1.2b-instruct:free', provider: 'openrouter' },
        fallbacks: [
            { id: 'nvidia/nemotron-3-super-120b-a12b:free', provider: 'openrouter' }
        ]
    },
    TECH: {
        name: 'Linux & Tech Support',
        primary: { id: 'nvidia/nemotron-3-super-120b-a12b:free', provider: 'openrouter' },
        fallbacks: [
            { id: 'gemini-3-flash-preview', provider: 'native' },
            { id: 'moonshot-v1-8k', provider: 'kimi' }
        ]
    },
    AUTOMATION: {
        name: 'System Automation',
        primary: { id: 'gemini-3-flash-preview', provider: 'native' },
        fallbacks: [
            { id: 'gemini-2.0-flash', provider: 'native' },
            { id: 'minimax/minimax-m2.5:free', provider: 'openrouter' }
        ]
    },

    // === General / Safety Net ===
    GENERAL: {
        name: 'General Assistant',
        primary: { id: 'gemini-3-flash-preview', provider: 'native' },
        fallbacks: [
            { id: 'moonshot-v1-8k', provider: 'kimi' },
            { id: 'gemini-2.5-flash', provider: 'native' },
            { id: 'minimax/minimax-m2.5:free', provider: 'openrouter' }
        ]
    }
};

export const COMMAND_TASK_MAP = {
    'code': 'CODE',
    'debug': 'DEBUG',
    'explain': 'BACKEND',
    'summary': 'GENERAL',
    'search': 'GENERAL',
    'ask': 'GENERAL',
    'ocr': 'VISION'
};
