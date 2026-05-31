import { insert, select, db } from './firebaseService.js';
import { log } from '../utils/logger.js';

const statsCache = new Map(); // Simple cache: userId -> { stats, timestamp }
const CACHE_TTL = 30000; // 30 seconds

export const usageService = {
    /**
     * Record usage in the database
     * @param {string} userId 
     * @param {string} type - AI_TOKENS, DOWNLOAD_MB, IMAGE_GEN
     * @param {number} amount 
     */
    logUsage: async (userId, type, amount) => {
        try {
            // Invalidate cache on write
            statsCache.delete(userId);
            await insert('usage_log', { user_id: userId, type, amount });
        } catch (error) {
            log.error('Usage Logging Failed:', error.message);
        }
    },

    /**
     * Clean up usage logs older than 30 days
     */
    cleanupUsageLog: async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            const snapshot = await db.collection('usage_log')
                .where('created_at', '<', thirtyDaysAgo)
                .get();
            
            if (snapshot.empty) return;

            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            log.success(`Old usage logs (30+ days) cleaned up. Removed ${snapshot.size} entries.`);
        } catch (error) {
            log.error('Failed to cleanup usage logs:', error.message);
        }
    },

    getDailyStats: async (userId) => {
        // 1. Check Cache
        const cached = statsCache.get(userId);
        const now = Date.now();
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.stats;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            // 2. Optimized Fetch
            const { data, error } = await select('usage_log', [
                { col: 'user_id', op: '==', val: userId },
                { col: 'created_at', op: '>=', val: today }
            ]);

            if (error) throw error;

            const stats = {
                aiTokens: 0,
                downloadMb: 0,
                imageGen: 0,
                commands: 0
            };

            data.forEach(row => {
                const amt = parseFloat(row.amount);
                if (row.type === 'AI_TOKENS') stats.aiTokens += amt;
                if (row.type === 'DOWNLOAD_MB') stats.downloadMb += amt;
                if (row.type === 'IMAGE_GEN') stats.imageGen += amt;
                if (row.type === 'COMMAND') stats.commands += 1;
            });

            // 3. Save to Cache
            statsCache.set(userId, { stats, timestamp: now });

            return stats;
        } catch (error) {
            log.error('Failed to fetch daily stats:', error.message);
            return null;
        }
    },

    /**
     * Check if user is over their daily budget
     */
    isOverLimit: async (userId) => {
        const stats = await usageService.getDailyStats(userId);
        if (!stats) return false;

        const LIMITS = {
            AI_TOKENS: 50000,
            DOWNLOAD_MB: 1000,
            IMAGE_GEN: 10
        };

        if (stats.aiTokens > LIMITS.AI_TOKENS) return 'AI_TOKENS';
        if (stats.downloadMb > LIMITS.DOWNLOAD_MB) return 'DOWNLOAD_MB';
        if (stats.imageGen > LIMITS.IMAGE_GEN) return 'IMAGE_GEN';

        return null;
    }
};
