# 🤖 Aruthtale AI — Provider & Model Registry

Proyek **ai-wa-bot** menggunakan arsitektur **3-Tier Provider** yang sangat tangguh untuk memproses pesan WhatsApp dari pengguna secara cerdas. Sistem ini menggunakan **Smart Router** untuk mendeteksi intensi (*intent*) pengguna dan mengarahkannya ke model spesialis terbaik, dengan mekanisme *fallback* otomatis jika batas kuota atau kendala teknis terjadi.

---

## 🗺️ Arsitektur 3-Tier Provider

Sistem *routing* AI disusun menjadi 3 tingkatan (Tier) utama untuk menjamin ketersediaan tinggi (High Availability) dan performa maksimal secara gratis/efisien:

```
┌─────────────────────────────────────────────────────────────────┐
│  Pesan Masuk (WhatsApp / ai-wa-bot)                              │
│                         ▼                                        │
│  Smart Router — Classify intent, pilih provider terbaik          │
│                         │                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Tier 1 — NVIDIA NIM (Primary)                              │ │
│  │  GLM-5.1 | DeepSeek V4 | Gemma 4 31B | MiniMax M2.7        │ │
│  │  ~40 req/min free prototyping                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                    429 / limit habis ↓                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Tier 2 — Groq LPU (Fallback)                              │ │
│  │  GPT-OSS 120B | Llama 3.3 70B | Kimi K2                    │ │
│  │  ~30 req/min, ~14,400 req/day                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                   1000 req/hari habis ↓                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Tier 3 — Emergency Backup                                 │ │
│  │  OpenRouter | Google AI Studio | Cerebras                   │ │
│  │  Free tier models / Gemini gratis                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                         ▼                                        │
│  Safety Filter → Nemotron Content Safety (Free)                  │
│                         ▼                                        │
│  Balasan ke User (WhatsApp Response)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1. **Tier 1 — NVIDIA NIM (Primary / Utama)**
*   **Host**: `integrate.api.nvidia.com`
*   **Env Key**: `NVIDIA_API_KEY`
*   **Daftar Model**:
    *   `z-ai/glm-5.1` (GLM-5.1)
    *   `deepseek-ai/deepseek-v4-flash` (DeepSeek V4 Flash)
    *   `deepseek-ai/deepseek-v4-pro` (DeepSeek V4 Pro)
    *   `meta/llama-3.3-70b-instruct` (Llama 3.3 70B Instruct)
    *   `nvidia/llama-3.3-nemotron-super-49b-v1.5` (Nemotron Super 49B)
    *   `openai/gpt-oss-120b` (GPT-OSS 120B)
    *   `google/gemma-4-31b-it` (Gemma 4 31B)
    *   `minimaxai/minimax-m2.7` (MiniMax M2.7)
    *   `mistralai/mistral-medium-3-5-128b` (Mistral Medium 3.5)
    *   `moonshotai/kimi-k2.6` (Kimi K2.6)
    *   `mistralai/mistral-small-4-119b-2603` (Mistral Small 4)
    *   `nvidia/nemotron-parse` (Nemotron Parse/OCR)
    *   `nvidia/nemotron-3-content-safety` (Nemotron Content Safety)
    *   `nvidia/nemotron-3-super-120b-a12b` (Nemotron 3 Super 120B)

### 2. 🟡 **Groq LPU**
*   **Host**: `api.groq.com`
*   **Env Key**: `GROQ_API_KEY`
*   **Daftar Model**:
    *   `openai/gpt-oss-120b` (GPT-OSS 120B)
    *   `llama-3.3-70b-versatile` (Llama 3.3 70B Versatile)
    *   `moonshotai/kimi-k2-instruct-0905` (Kimi K2)

### 3. ⚡ **Google AI Studio (Native)**
*   **Host**: `generativelanguage.googleapis.com`
*   **Env Key**: `GEMINI_API_KEY`
*   **Daftar Model**:
    *   `gemini-3.5-flash` (Gemini 3.5 Flash)
    *   `gemini-3-flash-preview` (Gemini 3 Flash Preview)

### 4. 🔴 **OpenRouter**
*   **Host**: `openrouter.ai`
*   **Env Key**: `OPENROUTER_API_KEY`
*   **Daftar Model**:
    *   `z-ai/glm-4.5-air:free` (GLM 4.5 Air Free)
    *   `minimax/minimax-m2.5:free` (MiniMax M2.5 Free)
    *   `nvidia/nemotron-3-super-120b-a12b:free` (Nemotron 3 Super 120B Free)
    *   `nousresearch/hermes-3-llama-3.1-405b:free` (Hermes 3 Llama 3.1 405B Free)
    *   `liquid/lfm-2.5-1.2b-instruct:free` (Liquid LFM 2.5 1.2B Free)

### 5. 🔵 **Cerebras**
*   **Host**: `api.cerebras.ai`
*   **Env Key**: `CEREBRAS_API_KEY`
*   **Daftar Model**:
    *   `llama3.1-8b` (Cerebras Llama 3.1 8B)

---

## 🔑 Kebutuhan Variabel Lingkungan (.env)
```env
NVIDIA_API_KEY="your_nvidia_nim_api_key"
GROQ_API_KEY="your_groq_api_key"
GEMINI_API_KEY="your_google_ai_studio_key"
OPENROUTER_API_KEY="your_openrouter_api_key"
CEREBRAS_API_KEY="your_cerebras_api_key"
```
