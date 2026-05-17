import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';

export const searchService = {
    /**
     * Search web using multiple fallback providers
     * @param {string} query 
     * @returns {Promise<Array<{title: string, link: string, snippet: string}>>}
     */
    search: async (query) => {
        // 1. Try Google Basic HTML (Very reliable)
        let results = await searchService.google(query);
        if (results.length > 0) return results;

        // 2. Try DuckDuckGo Lite (Fallback)
        log.warn('[Search] Google failed, trying DuckDuckGo...');
        results = await searchService.duckDuckGo(query);
        if (results.length > 0) return results;

        // 3. Try Bing (Fallback)
        log.warn('[Search] DuckDuckGo failed, trying Bing...');
        results = await searchService.bing(query);
        if (results.length > 0) return results;

        // 4. Try SearXNG Public Instance
        log.warn('[Search] Bing failed, trying SearXNG...');
        results = await searchService.searxng(query);
        
        return results;
    },

    /**
     * Google Basic HTML Scraper (gbv=1)
     */
    google: async (query) => {
        try {
            log.info(`[Search] Google Basic: ${query}`);
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gbv=1&lr=lang_id`;
            const { data } = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 5000
            });
            const $ = cheerio.load(data);
            const results = [];
            
            // Google Basic HTML structure (ZIN6ue / kCrYT are common)
            $('.ZIN6ue, .kCrYT').each((i, el) => {
                const titleEl = $(el).find('h3');
                const linkEl = $(el).find('a');
                const title = titleEl.text().trim();
                let link = linkEl.attr('href');
                
                if (link && link.startsWith('/url?q=')) {
                    link = link.split('/url?q=')[1].split('&')[0];
                    link = decodeURIComponent(link);
                }

                // Snippet is usually in a div with class BNeawe s3v9rd AP7Wnd or similar
                const snippet = $(el).find('.BNeawe.s3v9rd.AP7Wnd').text().trim() || 
                                $(el).find('.st').text().trim();
                
                if (title && link && !link.includes('google.com')) {
                    results.push({ title, link, snippet: snippet.substring(0, 300) });
                }
            });
            
            // Deduplicate by link
            const seen = new Set();
            const finalResults = results.filter(r => {
                if (seen.has(r.link)) return false;
                seen.add(r.link);
                return true;
            });

            return finalResults.slice(0, 5);
        } catch (e) { 
            log.warn(`[Search] Google failed: ${e.message}`);
            return []; 
        }
    },

    /**
     * DuckDuckGo Lite Scraper
     */
    duckDuckGo: async (query) => {
        try {
            log.info(`[Search] DuckDuckGo Lite: ${query}`);
            const url = `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
                },
                timeout: 10000
            });
            const $ = cheerio.load(data);
            const results = [];
            
            // Check if blocked
            if ($('title').text().includes('Blocked') || $('body').text().includes('Security Check')) {
                log.warn('[Search] DuckDuckGo blocked the request.');
                return [];
            }

            $('.result-link').each((i, el) => {
                const title = $(el).text().trim();
                const link = $(el).attr('href');
                
                // Snippet is usually in the next element with class 'result-snippet'
                const parentRow = $(el).closest('tr');
                const snippetRow = parentRow.next();
                const snippet = snippetRow.find('.result-snippet').text().trim();
                
                if (title && link) {
                    results.push({ title, link, snippet: snippet || 'No snippet available.' });
                }
            });
            
            return results.slice(0, 5);
        } catch (e) { 
            log.warn(`[Search] DuckDuckGo failed: ${e.message}`);
            return []; 
        }
    },

    /**
     * Bing Scraper (Improved)
     */
    bing: async (query) => {
        try {
            log.info(`[Search] Bing: ${query}`);
            const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
                },
                timeout: 5000
            });
            const $ = cheerio.load(data);
            const results = [];
            $('.b_algo').each((i, el) => {
                const title = $(el).find('h2').text().trim();
                const link = $(el).find('h2 a').attr('href');
                const snippet = $(el).find('.b_caption p, .b_snippet, .b_algo_snippet').text().trim();
                if (title && link) results.push({ title, link, snippet: snippet || 'No snippet.' });
            });
            return results.slice(0, 5);
        } catch (e) { 
            log.warn(`[Search] Bing failed: ${e.message}`);
            return []; 
        }
    },

    /**
     * SearXNG Fallback (JSON API)
     */
    searxng: async (query) => {
        const instances = [
            'https://searx.be', 
            'https://searx.work', 
            'https://priv.au',
            'https://searx.tiekoetter.com',
            'https://search.ononoki.org',
            'https://searx.ooguy.com',
            'https://searx.prvcy.eu',
            'https://searx.nixnet.services',
            'https://search.mdosch.de',
            'https://searx.sethforprivacy.com',
            'https://searx.fedi.cloud'
        ];
        
        for (const instance of instances) {
            try {
                log.info(`[Search] Trying SearXNG instance: ${instance}`);
                const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json`;
                const { data } = await axios.get(url, { 
                    timeout: 4000,
                    headers: { 'User-Agent': 'Aruthtale-Bot/1.0' }
                });
                
                if (data.results && data.results.length > 0) {
                    return data.results
                        .filter(r => r.title && r.url)
                        .map(r => ({
                            title: r.title,
                            link: r.url,
                            snippet: r.content || r.snippet || ''
                        })).slice(0, 5);
                }
            } catch (e) { 
                log.warn(`[Search] SearXNG instance ${instance} failed: ${e.message}`);
                continue; 
            }
        }
        return [];
    }
};
