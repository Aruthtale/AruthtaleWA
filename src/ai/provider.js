import { aiRouter } from './router.js';
import { askGemini } from './gemini.js';
import { log } from '../utils/logger.js';

export const aiProvider = {
    /**
     * Main entry point - routes to the best specialist model
     * @param {string} prompt
     * @param {object} options - { task, history, systemInstruction, image, audio }
     * @returns {object} { text, usage, model }
     */
    chat: async (prompt, options = {}) => {
        return await aiRouter.route(prompt, options);
    },

    /**
     * Direct Gemini access with function calling (for system commands)
     * Use this when fsTools/function calling is explicitly needed
     */
    chatWithTools: async (prompt, options = {}) => {
        try {
            return await askGemini(prompt, options);
        } catch (error) {
            log.error('Gemini with tools failed:', error.message);
            throw error;
        }
    }
};

export default aiProvider;
