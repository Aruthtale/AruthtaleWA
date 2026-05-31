/**
 * AI Model Registry v2.0 - 3-Tier Provider Architecture
 * 
 * ┌─────────────────────────────────────────────────────┐
 * │  Tier 1 — NVIDIA NIM (Primary)                      │
 * │  GLM-5.1, DeepSeek V4, Gemma 4, MiniMax M2.7       │
 * │  ~40 req/min free prototyping                       │
 * ├─────────────────────────────────────────────────────┤
 * │  Tier 2 — Groq LPU (Fallback)                      │
 * │  GPT-OSS 120B, Llama 3.3 70B, Kimi K2              │
 * │  ~30 req/min, ~14,400 req/day                      │
 * ├─────────────────────────────────────────────────────┤
 * │  Tier 3 — Emergency Backup                         │
 * │  OpenRouter (multi-model), Google AI Studio,       │
 * │  Cerebras (Llama 3.3 70B ultra-fast)               │
 * └─────────────────────────────────────────────────────┘
 * 
 * Safety Filter: Nemotron Content Safety (Free Endpoint)
 */

// ============================================================
// PROVIDER CONSTANTS
// ============================================================
export const PROVIDERS = {
    NVIDIA: 'nvidia',      // Tier 1 — integrate.api.nvidia.com
    GROQ: 'groq',          // Tier 2 — api.groq.com
    OPENROUTER: 'openrouter', // Tier 3 — openrouter.ai
    NATIVE: 'native',      // Tier 3 — Google AI Studio (generativelanguage.googleapis.com)
    CEREBRAS: 'cerebras',  // Tier 3 — api.cerebras.ai
    KIMI: 'kimi',          // Legacy — Moonshot AI (api.moonshot.ai)
};

// ============================================================
// MODEL CATALOG - Organized by Provider & Category
// ============================================================

// --- Tier 1: NVIDIA NIM Models ---
export const NVIDIA_MODELS = {
    // 🧠 Coding & Agentic AI
    GLM_5_1:            'z-ai/glm-5.1',
    DEEPSEEK_V4_FLASH:  'deepseek-ai/deepseek-v4-flash',
    DEEPSEEK_V4_PRO:    'deepseek-ai/deepseek-v4-pro',

    // ⚡ Fast Boot (pre-warmed, respond cepat)
    LLAMA_3_3_70B_NV:   'meta/llama-3.3-70b-instruct',
    NEMOTRON_SUPER_49B: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    GPT_OSS_120B_NV:    'openai/gpt-oss-120b',

    // 🧠 General Reasoning & Chat
    GEMMA_4_31B:        'google/gemma-4-31b-it',
    MINIMAX_M2_7:       'minimaxai/minimax-m2.7',
    MISTRAL_MEDIUM_3_5: 'mistralai/mistral-medium-3-5-128b',

    // 🤖 Multimodal (Text + Image + Video)
    KIMI_K2_6:          'moonshotai/kimi-k2.6',
    MISTRAL_SMALL_4:    'mistralai/mistral-small-4-119b-2603',

    // 📄 OCR & Document Intelligence
    NEMOTRON_OCR:       'nvidia/nemotron-parse',

    // 🔒 Safety & Content Moderation
    NEMOTRON_SAFETY:    'nvidia/nemotron-3-content-safety',

    // 🧪 Agentic Reasoning
    NEMOTRON_SUPER_120B: 'nvidia/nemotron-3-super-120b-a12b',
};

// --- Tier 2: Groq LPU Models ---
export const GROQ_MODELS = {
    GPT_OSS_120B:       'openai/gpt-oss-120b',
    LLAMA_3_3_70B:      'llama-3.3-70b-versatile',
    KIMI_K2:            'moonshotai/kimi-k2-instruct-0905',
};

// --- Tier 3: Emergency Models ---
export const EMERGENCY_MODELS = {
    // OpenRouter
    OR_GLM_FREE:        'z-ai/glm-4.5-air:free',
    OR_MINIMAX_FREE:    'minimax/minimax-m2.5:free',
    OR_NEMOTRON_FREE:   'nvidia/nemotron-3-super-120b-a12b:free',
    OR_HERMES_FREE:     'nousresearch/hermes-3-llama-3.1-405b:free',
    OR_LIQUID_FREE:     'liquid/lfm-2.5-1.2b-instruct:free',

    // Google AI Studio (Native)
    GEMINI_3_0_FLASH:   'gemini-3-flash-preview',
    GEMINI_3_5_FLASH:   'gemini-3.5-flash',

    // Cerebras
    CEREBRAS_LLAMA_8B:  'llama3.1-8b',
};

// ============================================================
// TASK-BASED MODEL ROUTING
// Each task has a chain: Tier 1 → Tier 2 → Tier 3
// ============================================================
export const AI_MODELS = {

    // === 💻 Coding & Agentic AI ===
    CODE: {
        name: 'Coding & Agentic AI',
        chain: [
            // Tier 1 — NVIDIA NIM (fast boot first, then specialist)
            { id: NVIDIA_MODELS.GPT_OSS_120B_NV, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.NEMOTRON_SUPER_49B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.DEEPSEEK_V4_FLASH, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.GPT_OSS_120B, provider: PROVIDERS.GROQ, tier: 2 },
            { id: GROQ_MODELS.KIMI_K2, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.OR_GLM_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.CEREBRAS_LLAMA_8B, provider: PROVIDERS.CEREBRAS, tier: 3 },
        ]
    },

    // === 🧠 General Reasoning & Chat ===
    GENERAL: {
        name: 'General Reasoning & Chat',
        chain: [
            // Tier 1 — NVIDIA NIM (fast boot first)
            { id: NVIDIA_MODELS.LLAMA_3_3_70B_NV, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.NEMOTRON_SUPER_49B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GEMMA_4_31B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.MINIMAX_M2_7, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.LLAMA_3_3_70B, provider: PROVIDERS.GROQ, tier: 2 },
            { id: GROQ_MODELS.GPT_OSS_120B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.OR_MINIMAX_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.CEREBRAS_LLAMA_8B, provider: PROVIDERS.CEREBRAS, tier: 3 },
        ]
    },

    // === 🤖 Multimodal (Vision / Image Analysis) ===
    VISION: {
        name: 'Multimodal Vision',
        chain: [
            // Tier 1 — NVIDIA NIM (multimodal-capable)
            { id: NVIDIA_MODELS.KIMI_K2_6, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.MISTRAL_SMALL_4, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GEMMA_4_31B, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.LLAMA_3_3_70B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency (Gemini native is best for vision)
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
        ]
    },

    // === 🐛 Debugging & Deep Thinking ===
    DEBUG: {
        name: 'Deep Thinking Debug',
        chain: [
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.DEEPSEEK_V4_PRO, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.NEMOTRON_SUPER_120B, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.GPT_OSS_120B, provider: PROVIDERS.GROQ, tier: 2 },
            { id: GROQ_MODELS.KIMI_K2, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.OR_NEMOTRON_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
            { id: EMERGENCY_MODELS.CEREBRAS_LLAMA_8B, provider: PROVIDERS.CEREBRAS, tier: 3 },
        ]
    },

    // === 🖥️ Frontend & UI/UX ===
    FRONTEND: {
        name: 'Frontend & UI/UX',
        chain: [
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.GEMMA_4_31B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.MINIMAX_M2_7, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.LLAMA_3_3_70B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.OR_MINIMAX_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
        ]
    },

    // === ⚙️ Backend & Architecture ===
    BACKEND: {
        name: 'Backend & Architecture',
        chain: [
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.DEEPSEEK_V4_FLASH, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.MISTRAL_MEDIUM_3_5, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.KIMI_K2, provider: PROVIDERS.GROQ, tier: 2 },
            { id: GROQ_MODELS.GPT_OSS_120B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.OR_HERMES_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
            { id: EMERGENCY_MODELS.CEREBRAS_LLAMA_8B, provider: PROVIDERS.CEREBRAS, tier: 3 },
        ]
    },

    // === 🐧 Linux & Tech Support ===
    TECH: {
        name: 'Linux & Tech Support',
        chain: [
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.NEMOTRON_SUPER_120B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GEMMA_4_31B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.DEEPSEEK_V4_FLASH, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq LPU
            { id: GROQ_MODELS.LLAMA_3_3_70B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.CEREBRAS_LLAMA_8B, provider: PROVIDERS.CEREBRAS, tier: 3 },
        ]
    },

    // === 🤖 System Automation (Owner-only, tools-enabled) ===
    AUTOMATION: {
        name: 'System Automation',
        chain: [
            // Automation always uses Gemini Native for tool calling first
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 0 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 0 },
            // Tier 1 — NVIDIA NIM (text-only fallback)
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq
            { id: GROQ_MODELS.GPT_OSS_120B, provider: PROVIDERS.GROQ, tier: 2 },
        ]
    },

    // === 📂 Project Context ===
    PROJECT: {
        name: 'Project Context',
        chain: [
            // Project queries need tools → Gemini native first
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 0 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 0 },
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.DEEPSEEK_V4_FLASH, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq
            { id: GROQ_MODELS.KIMI_K2, provider: PROVIDERS.GROQ, tier: 2 },
        ]
    },

    // === 🎨 CSS & Boilerplate ===
    CSS: {
        name: 'CSS & Boilerplate',
        chain: [
            // Tier 1 — NVIDIA NIM
            { id: NVIDIA_MODELS.GEMMA_4_31B, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.GLM_5_1, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Tier 2 — Groq
            { id: GROQ_MODELS.LLAMA_3_3_70B, provider: PROVIDERS.GROQ, tier: 2 },
            // Tier 3 — Emergency
            { id: EMERGENCY_MODELS.OR_MINIMAX_FREE, provider: PROVIDERS.OPENROUTER, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
        ]
    },

    // === 📄 OCR & Document ===
    OCR: {
        name: 'OCR & Document Intelligence',
        chain: [
            // Tier 1 — NVIDIA Nemotron OCR is specialized
            { id: NVIDIA_MODELS.NEMOTRON_OCR, provider: PROVIDERS.NVIDIA, tier: 1 },
            { id: NVIDIA_MODELS.KIMI_K2_6, provider: PROVIDERS.NVIDIA, tier: 1 },
            // Fallback to Gemini native for vision
            { id: EMERGENCY_MODELS.GEMINI_3_5_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
            { id: EMERGENCY_MODELS.GEMINI_3_0_FLASH, provider: PROVIDERS.NATIVE, tier: 3 },
        ]
    },
};

// ============================================================
// COMMAND → TASK MAPPING
// ============================================================
export const COMMAND_TASK_MAP = {
    'code': 'CODE',
    'debug': 'DEBUG',
    'explain': 'BACKEND',
    'summary': 'GENERAL',
    'search': 'GENERAL',
    'ask': 'GENERAL',
    'ocr': 'OCR',
    'css': 'CSS',
    'tech': 'TECH',
    'project': 'PROJECT',
};

// ============================================================
// TIER LABELS (for logging)
// ============================================================
export const TIER_LABELS = {
    0: '⚡ NATIVE',
    1: '🟢 NVIDIA NIM',
    2: '🟡 GROQ LPU',
    3: '🔴 EMERGENCY',
};
