import { askGemini } from '../../ai/gemini.js';
import { askOpenRouter } from '../../ai/openrouter.js';
import { askNvidia } from '../../ai/nvidia.js';
import { askGroq } from '../../ai/groq.js';
import { askCerebras } from '../../ai/cerebras.js';
import { memoryService } from '../../services/memory.js';
import { settings } from '../../config/settings.js';
import { log } from '../../utils/logger.js';

/**
 * !ping — Health Check semua AI Provider (3-Tier)
 * Tests: NVIDIA NIM, Groq LPU, OpenRouter, Google AI Studio, Cerebras, Firebase
 */
export default async (sock, m, args) => {
    const remoteJid = m.key.remoteJid;
    const startAll = Date.now();
    
    try {
        const { key } = await sock.sendMessage(remoteJid, { text: '🏓 *Pinging 6 services...*' }, { quoted: m });

        // Helper: ping with timeout
        const pingWithTimeout = (fn, timeoutMs = 15000) => {
            return Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
            ]);
        };

        // Helper: format result
        const formatResult = (label, latency, error) => {
            if (error) {
                const errMsg = error.message === 'Timeout' ? '⏱️ Timeout' : 
                               error.message?.includes('not configured') ? '🔑 No Key' :
                               `❌ ${error.response?.status || error.message?.substring(0, 20) || 'Error'}`;
                return { label, status: errMsg, ok: false };
            }
            const statusIcon = latency < 3000 ? '🟢' : latency < 8000 ? '🟡' : '🔴';
            return { label, status: `${statusIcon} ${latency}ms`, ok: true };
        };

        // Run ALL pings in parallel for speed
        const results = await Promise.allSettled([
            // 1. NVIDIA NIM (Tier 1)
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => askNvidia('hi', 'meta/llama-3.3-70b-instruct', { 
                    systemInstruction: 'respond with ok', maxTokens: 5 
                }), 20000);
                return { label: '🟢 NVIDIA NIM', latency: Date.now() - start };
            })(),

            // 2. Groq LPU (Tier 2)
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => askGroq('hi', 'llama-3.3-70b-versatile', { 
                    systemInstruction: 'respond with ok', maxTokens: 5 
                }));
                return { label: '🟡 Groq LPU', latency: Date.now() - start };
            })(),

            // 3. OpenRouter (Tier 3)
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => askOpenRouter('hi', 'minimax/minimax-m2.5:free'));
                return { label: '🔴 OpenRouter', latency: Date.now() - start };
            })(),

            // 4. Google AI Studio (Tier 3)
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => askGemini('hi', { systemInstruction: 'respond with ok' }));
                return { label: '🔴 Gemini', latency: Date.now() - start };
            })(),

            // 5. Cerebras (Tier 3)
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => askCerebras('hi', 'llama3.1-8b', { 
                    systemInstruction: 'respond with ok', maxTokens: 5 
                }));
                return { label: '🔴 Cerebras', latency: Date.now() - start };
            })(),

            // 6. Firebase Firestore
            (async () => {
                const start = Date.now();
                await pingWithTimeout(() => db.listCollections(), 10000);
                return { label: '🔥 Firebase', latency: Date.now() - start };
            })(),
        ]);

        // Format results
        const rows = results.map((r, i) => {
            if (r.status === 'fulfilled') {
                return formatResult(r.value.label, r.value.latency, null);
            } else {
                const labels = ['🟢 NVIDIA NIM', '🟡 Groq LPU', '🔴 OpenRouter', '🔴 Gemini', '🔴 Cerebras', '🔥 Firebase'];
                return formatResult(labels[i], 0, r.reason);
            }
        });

        const totalLat = Date.now() - startAll;
        const onlineCount = rows.filter(r => r.ok).length;
        const totalCount = rows.length;

        // Build tier summary
        const tier1Ok = rows[0].ok;
        const tier2Ok = rows[1].ok;
        const tier3Ok = rows[2].ok || rows[3].ok || rows[4].ok;

        let activeRoute = '❌ All Down';
        if (tier1Ok) activeRoute = '🟢 NVIDIA NIM (Tier 1)';
        else if (tier2Ok) activeRoute = '🟡 Groq LPU (Tier 2)';
        else if (tier3Ok) activeRoute = '🔴 Emergency (Tier 3)';

        // API Key status
        const keyStatus = [
            settings.nvidiaKey ? '✅' : '❌',
            settings.groqKey && settings.groqKey !== 'YOUR_GROQ_API_KEY_HERE' ? '✅' : '❌',
            settings.openRouterKey ? '✅' : '❌',
            settings.geminiKey ? '✅' : '❌',
            settings.cerebrasKey && settings.cerebrasKey !== 'YOUR_CEREBRAS_API_KEY_HERE' ? '✅' : '❌',
        ];

        const report = 
            `📊 *AI PROVIDER HEALTH CHECK* 📊\n\n` +
            `┌─── Tier 1 — Primary ───\n` +
            `│ ${rows[0].label}: \`${rows[0].status}\` ${keyStatus[0]}\n` +
            `├─── Tier 2 — Fallback ───\n` +
            `│ ${rows[1].label}: \`${rows[1].status}\` ${keyStatus[1]}\n` +
            `├─── Tier 3 — Emergency ───\n` +
            `│ ${rows[2].label}: \`${rows[2].status}\` ${keyStatus[2]}\n` +
            `│ ${rows[3].label}: \`${rows[3].status}\` ${keyStatus[3]}\n` +
            `│ ${rows[4].label}: \`${rows[4].status}\` ${keyStatus[4]}\n` +
            `├─── Database ───\n` +
            `│ ${rows[5].label}: \`${rows[5].status}\`\n` +
            `└────────────────\n\n` +
            `🎯 *Active Route:* ${activeRoute}\n` +
            `📡 *Online:* ${onlineCount}/${totalCount} services\n` +
            `⚡ *Total Ping:* \`${totalLat}ms\`\n` +
            `🔑 *Keys:* NV${keyStatus[0]} GQ${keyStatus[1]} OR${keyStatus[2]} GM${keyStatus[3]} CB${keyStatus[4]}`;

        await sock.sendMessage(remoteJid, { text: report, edit: key });
        
    } catch (error) {
        log.error('Ping command failed:', error.message);
        await sock.sendMessage(remoteJid, { text: `❌ *Ping Failed:* ${error.message}` });
    }
};
