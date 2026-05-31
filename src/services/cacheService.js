import { log } from '../utils/logger.js';
import { db } from './firebaseService.js';
import crypto from 'crypto';

export const cacheService = {
    /**
     * Get cached metadata for a URL
     */
    getCache: async (url) => {
        try {
            const docId = crypto.createHash('md5').update(url).digest('hex');
            const doc = await db.collection('media_cache').doc(docId).get();

            if (!doc.exists) return null;
            return doc.data().metadata;
        } catch (err) {
            log.error(`Cache Get Error: ${err.message}`);
            return null;
        }
    },

    /**
     * Store metadata in cache
     */
    saveCache: async (url, metadata) => {
        try {
            const docId = crypto.createHash('md5').update(url).digest('hex');
            await db.collection('media_cache').doc(docId).set({
                url,
                metadata,
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            log.error(`Cache Save Error: ${err.message}`);
        }
    }
};

