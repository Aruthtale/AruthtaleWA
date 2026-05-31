import { db } from './firebaseService.js';
import { log } from '../utils/logger.js';
import admin from 'firebase-admin';

export const firebaseRetentionService = {
    /**
     * Clean up documents older than 7 days in specified collections
     */
    cleanupOldData: async () => {
        log.system('Running Firestore Data Retention Cleanup (7-day TTL)...');
        
        const collectionsToClean = ['ai_metrics', 'usage_log', 'memories', 'reminders'];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        for (const col of collectionsToClean) {
            try {
                const snapshot = await db.collection(col)
                    .where('created_at', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
                    .get();

                if (snapshot.empty) {
                    log.info(`No expired documents in ${col}.`);
                    continue;
                }

                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                log.success(`Deleted ${snapshot.size} expired documents from ${col}.`);
            } catch (err) {
                log.error(`Error cleaning up ${col}:`, err.message);
            }
        }
    }
};
