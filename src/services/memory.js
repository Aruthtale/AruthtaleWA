import { createClient } from '@supabase/supabase-js';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';
import { embedText } from '../ai/gemini.js';
import { aiProvider } from '../ai/provider.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

export const memoryService = {
    // 🛡️ Filter Spam agar tidak memenuhi database
    isSpam: (content) => {
        if (!content) return true;
        const text = content.trim();
        if (text.length < 2) return true; 
        if (/^(.)\1{4,}$/.test(text)) return true; 
        return false;
    },

    save: async (userId, role, content) => {
        if (memoryService.isSpam(content)) return;
        try {
            // 0. Safety check for Supabase
            if (!supabase) return;

            // 1. Save to standard memories (short-term)
            const { error: insErr } = await supabase.from('memories').insert([{ user_id: userId, role, content }]);
            if (insErr) throw insErr;
            
            // 2. Save to long-term vector memory (only for significant messages)
            if (content.length > 10) {
                const embedding = await embedText(content);
                if (embedding) {
                    await supabase.from('long_term_memories').insert([{
                        user_id: userId,
                        content: content,
                        embedding: embedding
                    }]);
                    log.memory(`Vektor memori disimpan untuk: "${content.substring(0, 30)}..."`);
                }
            }
            
            log.memory(`Saved ${role} message to short-term memory.`);
            
            // Only check summarization roughly every 5 messages (20% chance) 
            // to save database resources and AI costs.
            if (Math.random() < 0.2) {
                memoryService.triggerSummarization(userId);
            }
        } catch (error) {
            log.error(`Memory Save Error: ${error.message}`);
        }
    },

    // 🧠 Ambil riwayat dengan dukungan RAG (Semantic Search)
    getHistory: async (userId, currentMessage = '', limit = 12, format = 'gemini') => {
        try {
            let contextText = '';

            // 1. Optimize RAG: Only run if message is long and looks like a question or reference
            const shouldRunRAG = currentMessage.length > 20 && 
                                / (ingat|pernah|dulu|waktu|tanya|cari|siapa|apa|kenapa|bagaimana) /i.test(currentMessage);

            if (shouldRunRAG) {
                try {
                    const queryEmbedding = await embedText(currentMessage);
                    if (queryEmbedding) {
                        const { data: matches, error: matchErr } = await supabase.rpc('match_memories', {
                            query_embedding: queryEmbedding,
                            match_threshold: 0.78, // Tighter threshold
                            match_count: 2,        // Less results for speed
                            p_user_id: userId
                        });

                        if (!matchErr && matches?.length > 0) {
                            contextText = matches.map(m => `[Konteks Masa Lalu: ${m.content}]`).join('\n');
                            log.memory(`Semantic Context found (${matches.length} matches)`);
                        }
                    }
                } catch (ragError) {
                    log.warn(`RAG Search failed: ${ragError.message}`);
                }
            }

            // 2. Ambil pesan terbaru
            if (!supabase) return [];
            const { data, error } = await supabase
                .from('memories')
                .select('role, content, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            
            // 3. Format untuk AI (Gemini vs OpenAI/Kimi)
            let history = data.reverse();
            
            if (format === 'openai') {
                const openaiHistory = history.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 
                          m.role === 'summary' ? 'system' : 'user',
                    content: m.role === 'summary' ? `[RINGKASAN]: ${m.content}` : m.content
                }));
                if (contextText) {
                    openaiHistory.unshift({ role: 'system', content: `KONTEKS MEMORI: ${contextText}` });
                }
                return openaiHistory;
            }

            // Default: Gemini Format
            const geminiHistory = history.map(m => ({
                role: m.role === 'assistant' ? 'model' : 
                      m.role === 'summary' ? 'system' : 'user',
                parts: [{ text: m.role === 'summary' ? `[RINGKASAN]: ${m.content}` : m.content }]
            }));

            if (contextText) {
                geminiHistory.unshift({
                    role: 'user',
                    parts: [{ text: `KONTEKS MEMORI:\n${contextText}` }]
                });
            }

            return geminiHistory;
        } catch (error) {
            log.error(`Memory Fetch Error: ${error.message}`);
            return [];
        }
    },

    // ✂️ Pangkas & Ringkas konteks jika terlalu panjang
    triggerSummarization: async (userId) => {
        try {
            // Hitung jumlah pesan
            const { count, error: countErr } = await supabase
                .from('memories')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .neq('role', 'summary');

            if (countErr) throw countErr;

            if (count > 25) {
                log.memory(`Percakapan terlalu panjang (${count} pesan). Memulai ringkasan...`);
                
                // Ambil 15 pesan tertua (kecuali summary)
                const { data: oldMessages, error: fetchErr } = await supabase
                    .from('memories')
                    .select('id, role, content')
                    .eq('user_id', userId)
                    .neq('role', 'summary')
                    .order('created_at', { ascending: true })
                    .limit(15);

                if (fetchErr) throw fetchErr;

                // Minta AI membuat ringkasan
                const textToSummarize = oldMessages.map(m => `${m.role}: ${m.content}`).join('\n');
                const summaryPrompt = `Ringkaslah percakapan berikut ini menjadi satu paragraf pendek yang padat dan jelas. Fokus pada poin-poin penting yang sudah dibahas:\n\n${textToSummarize}`;
                
                const summary = await aiProvider.chat(summaryPrompt, { 
                    systemInstruction: "Kamu adalah asisten pembuat ringkasan memori yang sangat akurat."
                });

                // Simpan ringkasan baru
                await supabase.from('memories').insert([{ 
                    user_id: userId, 
                    role: 'summary', 
                    content: summary 
                }]);

                // Hapus pesan lama yang sudah diringkas
                const idsToDelete = oldMessages.map(m => m.id);
                await supabase.from('memories').delete().in('id', idsToDelete);

                log.success(`Memory summarized & pruned. Context size optimized.`);
            }
        } catch (error) {
            log.error('Summarization Error:', error.message);
        }
    },

    // 🏓 Ping DB
    ping: async () => {
        const { error } = await supabase.from('memories').select('id').limit(1);
        if (error) throw error;
        return true;
    }
};
