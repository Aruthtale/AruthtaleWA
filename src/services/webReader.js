import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';

export const webReader = {
    /**
     * Extract main text content from a URL
     * @param {string} url 
     * @returns {Promise<string>}
     */
    extractText: async (url) => {
        try {
            log.info(`Reading URL: ${url}`);
            const { data: html } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(html);

            // Remove noise
            $('script, style, nav, footer, header, ads, .ads, #ads').remove();

            // Try to get main content
            let text = '';
            
            // Heuristic for main content: article, main, or divs with lots of p tags
            const selectors = ['article', 'main', '.post-content', '.entry-content', '#content'];
            for (const selector of selectors) {
                const content = $(selector).text().trim();
                if (content.length > 500) {
                    text = content;
                    break;
                }
            }

            // Fallback: take all p tags
            if (!text) {
                text = $('p').map((i, el) => $(el).text()).get().join('\n').trim();
            }

            // Clean up text
            text = text.replace(/\s+/g, ' ').slice(0, 10000); // Max 10k chars for AI

            if (text.length < 100) {
                throw new Error('Konten terlalu pendek atau gagal diekstrak.');
            }

            return text;
        } catch (error) {
            log.error('Web reading error:', error.message);
            throw new Error(`Gagal membaca website: ${error.message}`);
        }
    }
};
