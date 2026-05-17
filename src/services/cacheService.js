import { createClient } from '@supabase/supabase-js';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

export const cacheService = {
    /**
     * Get cached metadata for a URL
     */
    get: async (url) => {
        try {
            const { data, error } = await supabase
                .from('media_cache')
                .select('metadata')
                .eq('url', url)
                .single();

            if (error) return null;
            return data.metadata;
        } catch (err) {
            return null;
        }
    },

    /**
     * Store metadata in cache
     */
    set: async (url, metadata) => {
        try {
            await supabase
                .from('media_cache')
                .upsert([{ url, metadata, updated_at: new Date() }]);
        } catch (err) {
            log.error(`Cache Save Error: ${err.message}`);
        }
    }
};
