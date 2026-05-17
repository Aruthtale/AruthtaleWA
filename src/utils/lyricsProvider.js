import axios from 'axios';
import { log } from './logger.js';

/**
 * Fetch lyrics from LRCLIB API
 * @param {string} artist 
 * @param {string} title 
 * @returns {Promise<string|null>}
 */
export const getLyrics = async (artist, title) => {
    try {
        log.info(`Searching lyrics for: ${artist} - ${title}`);
        
        // Clean up title (remove "(feat. ...)", "- Remastered", etc for better search)
        const cleanTitle = title.replace(/\(feat\..*?\)|- .*?Remastered/gi, '').trim();
        
        const response = await axios.get('https://lrclib.net/api/search', {
            params: {
                artist_name: artist,
                track_name: cleanTitle
            },
            timeout: 10000
        });

        const tracks = response.data;
        if (!tracks || tracks.length === 0) return null;

        // Try to find the best match (prioritize synced lyrics, then plain lyrics)
        const track = tracks.find(t => t.syncedLyrics) || tracks[0];
        
        return track.plainLyrics || track.syncedLyrics || null;
    } catch (error) {
        log.error('Lyrics Provider Error:', error.message);
        return null;
    }
};
