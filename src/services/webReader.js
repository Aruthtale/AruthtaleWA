import axios from 'axios';
import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';
import { browserService } from './browserService.js';

export const webReader = {
    /**
     * Extract main text content from a URL
     * @param {string} url 
     * @returns {Promise<string>}
     */
    extractText: async (url) => {
        try {
            // Direct Browser Mode for known SPA/Heavy sites
            if (url.includes('instagram.com') || url.includes('facebook.com') || url.includes('tiktok.com')) {
                log.info(`Direct Browser Mode triggered for: ${url}`);
                const browserResult = await browserService.scrape(url, { lightweight: true });
                return browserResult.text;
            }

            log.info(`Reading URL (Fast Mode): ${url}`);
            const { data: html } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                timeout: 8000
            });

            const $ = cheerio.load(html);
            $('script, style, nav, footer, header, ads, .ads, #ads').remove();

            let text = '';
            const selectors = ['article', 'main', '.post-content', '.entry-content', '#content', '.article-body'];
            for (const selector of selectors) {
                const content = $(selector).text().trim();
                if (content.length > 500) {
                    text = content;
                    break;
                }
            }

            if (!text) {
                text = $('p').map((i, el) => $(el).text()).get().join('\n').trim();
            }

            // Clean up text
            text = text.replace(/\s+/g, ' ').trim();

            // If text is too short, it might be a JS-rendered page
            if (text.length < 300) {
                log.info(`Content too short (${text.length} chars). Switching to Browser Mode...`);
                const browserResult = await browserService.scrape(url);
                return browserResult.text;
            }

            return text.slice(0, 10000);
        } catch (error) {
            log.warn(`Fast mode failed for ${url}: ${error.message}. Switching to Browser Mode...`);
            try {
                const browserResult = await browserService.scrape(url);
                return browserResult.text;
            } catch (browserError) {
                log.error('Web reading error (both modes):', browserError.message);
                throw new Error(`Gagal membaca website: ${browserError.message}`);
            }
        }
    }
};
