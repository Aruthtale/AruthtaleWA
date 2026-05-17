import { createClient } from '@supabase/supabase-js';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

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

        // 2. Check Supabase (dynamic)
        try {
            const { data, error } = await supabase
                .from('whitelist')
                .select('number')
                .eq('number', number)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return false; // Not found
                log.error(`Auth DB Error: ${error.message}`);
                return false;
            }

            return !!data;
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
            const { error } = await supabase
                .from('whitelist')
                .upsert([{ number, name }]);

            if (error) throw error;
            log.success(`Added ${number} to dynamic whitelist.`);
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
            const { data, error } = await supabase
                .from('whitelist')
                .select('*');

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
            const { error } = await supabase
                .from('whitelist')
                .delete()
                .eq('number', number);

            if (error) throw error;
            return true;
        } catch (err) {
            log.error(`Failed to remove auth: ${err.message}`);
            throw err;
        }
    }
};
