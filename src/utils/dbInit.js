import { db } from '../services/firebaseService.js';
import { log } from '../utils/logger.js';

/**
 * Validates Firestore connection and logs the database status.
 * Since Firestore is schema-less, we don't need to check for table existence
 * like we did with Supabase. Collections are created on-demand.
 */
export const checkDatabase = async () => {
    log.system('🔍 Validating Firestore Connection...');
    try {
        // Test connection by querying a collection
        await db.collection('memories').limit(1).get();
        log.success('✅ Firestore connection is healthy.');
        log.system('Using Firebase Firestore as primary cloud database.');
    } catch (err) {
        log.error('❌ Firestore connection failed:', err.message);
        log.warn('Please ensure service-account.json is present and valid.');
        // We don't necessarily want to kill the process here, but we log the critical error
    }
};

// If run directly
if (process.argv[1] && import.meta.url.includes(process.argv[1])) {
    checkDatabase();
}
