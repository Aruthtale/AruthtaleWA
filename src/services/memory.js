import { insert, select, db } from './firebaseService.js';
import { log } from '../utils/logger.js';
import { embedText } from '../ai/gemini.js';
import { aiProvider } from '../ai/provider.js';

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
            // 1. Save to standard memories (short-term)
            const { error: insErr } = await insert('memories', { user_id: userId, role, content });
            if (insErr) throw insErr;
            
            // 2. Save to long-term vector memory (only for significant messages)
            if (content.length > 10) {
                const embedding = await embedText(content);
                if (embedding) {
                    await insert('long_term_memories', {
                        user_id: userId,
                        content: content,
                        embedding: embedding
                    });
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

    getHistory: async (userId, currentMessage = '', limit = 12, format = 'gemini') => {
        try {
            let contextText = '';

            // 1. RAG (Semantic Search) - Disabled for Firestore transition
            // Note: Requires Firestore Vector Search setup
            /*
            const shouldRunRAG = currentMessage.length > 20 && ...
            */

            // 2. Ambil pesan terbaru
            const snapshot = await db.collection('memories')
                .where('user_id', '==', userId)
                .orderBy('created_at', 'desc')
                .limit(limit)
                .get();

            const data = snapshot.docs.map(doc => doc.data());
            
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
            const snapshot = await db.collection('memories')
                .where('user_id', '==', userId)
                .where('role', '!=', 'summary')
                .get();
            
            const count = snapshot.size;

            if (count > 25) {
                log.memory(`Percakapan terlalu panjang (${count} pesan). Memulai ringkasan...`);
                
                // Ambil 15 pesan tertua (kecuali summary)
                const oldMessagesSnapshot = await db.collection('memories')
                    .where('user_id', '==', userId)
                    .where('role', '!=', 'summary')
                    .orderBy('role') // Required by Firestore when using != and orderBy
                    .orderBy('created_at', 'asc')
                    .limit(15)
                    .get();

                const oldMessages = oldMessagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (oldMessages.length === 0) return;

                // Minta AI membuat ringkasan
                const textToSummarize = oldMessages.map(m => `${m.role}: ${m.content}`).join('\n');
                const summaryPrompt = `Ringkaslah percakapan berikut ini menjadi satu paragraf pendek yang padat dan jelas. Fokus pada poin-poin penting yang sudah dibahas:\n\n${textToSummarize}`;
                
                const summary = await aiProvider.chat(summaryPrompt, { 
                    systemInstruction: "Kamu adalah asisten pembuat ringkasan memori yang sangat akurat."
                });

                // Simpan ringkasan baru
                await insert('memories', { 
                    user_id: userId, 
                    role: 'summary', 
                    content: summary 
                });

                // Hapus pesan lama yang sudah diringkas
                const batch = db.batch();
                oldMessagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                log.success(`Memory summarized & pruned. Context size optimized.`);
            }
        } catch (error) {
            log.error('Summarization Error:', error.message);
        }
    },

    // 🏓 Ping DB
    ping: async () => {
        try {
            await db.collection('memories').limit(1).get();
            return true;
        } catch (error) {
            log.error('DB Ping Error:', error.message);
            throw error;
        }
    }
};
