import { log } from '../utils/logger.js';

class AICacheService {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100;
        this.ttl = 1000 * 60 * 30; // 30 minutes
    }

    /**
     * Get cached response
     * @param {string} prompt 
     * @param {string} userId 
     * @returns {object|null}
     */
    get(prompt, userId) {
        const key = `${userId}:${prompt.trim().toLowerCase()}`;
        const entry = this.cache.get(key);
        
        if (entry) {
            if (Date.now() - entry.timestamp < this.ttl) {
                log.ai(`[Cache] Hit for prompt from ${userId}`);
                return entry.response;
            }
            this.cache.delete(key);
        }
        return null;
    }

    /**
     * Set cache entry
     * @param {string} prompt 
     * @param {string} userId 
     * @param {object} response 
     */
    set(prompt, userId, response) {
        const key = `${userId}:${prompt.trim().toLowerCase()}`;
        
        // Simple LRU-ish eviction
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            response,
            timestamp: Date.now()
        });
    }

    clear(userId) {
        if (userId) {
            for (const key of this.cache.keys()) {
                if (key.startsWith(`${userId}:`)) this.cache.delete(key);
            }
        } else {
            this.cache.clear();
        }
    }
}

export const aiCache = new AICacheService();
export default aiCache;
