import { select, insert, db, firebaseAdmin } from './firebaseService.js';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

export const authService = {
    /**
     * Check if a number is authorized (either in .env or Supabase)
     * @param {string} number 
     * @returns {Promise<boolean>}
     */
    isAuthorized: async (number) => {
        // 1. Check .env first (static)
        const isStaticAuth = settings.authorizedNumbers.some(num => number === num.trim());
        if (isStaticAuth) return true;

        // 2. Check Firestore (dynamic)
        try {
            const { data, error } = await select('whitelist', [
                { col: 'number', op: '==', val: number }
            ]);

            if (error) {
                log.error(`Auth DB Error: ${error.message}`);
                return false;
            }

            return data && data.length > 0;
        } catch (err) {
            log.error(`Auth Service Error: ${err.message}`);
            return false;
        }
    },

    /**
     * Add a number to dynamic whitelist
     * @param {string} number 
     * @param {string} name 
     */
    addAuthorized: async (number, name = 'Added via Bot') => {
        try {
            // Use number as doc ID for easy upsert
            await db.collection('whitelist').doc(number).set({
                number,
                name,
                updated_at: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            log.success(`Added/Updated ${number} in dynamic whitelist.`);
            return true;
        } catch (err) {
            log.error(`Failed to add auth: ${err.message}`);
            throw err;
        }
    },

    /**
     * List all dynamic authorized users
     */
    listAuthorized: async () => {
        try {
            const { data, error } = await select('whitelist');
            if (error) throw error;
            return data;
        } catch (err) {
            log.error(`Failed to list auth: ${err.message}`);
            return [];
        }
    },

    /**
     * Remove a number from dynamic whitelist
     */
    removeAuthorized: async (number) => {
        try {
            await db.collection('whitelist').doc(number).delete();
            log.success(`Removed ${number} from dynamic whitelist.`);
            return true;
        } catch (err) {
            log.error(`Failed to remove auth: ${err.message}`);
            throw err;
        }
    }
};
