import { browserService } from './browserService.js';
import { log } from '../utils/logger.js';

export const mapsScraper = {
    /**
     * Scrape Google Maps for business leads
     * @param {string} query 
     * @param {number} limit 
     */
    scrape: async (query, limit = 10) => {
        await browserService.init();
        const context = await browserService.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        // Lightweight mode for Maps
        await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', route => route.abort());

        try {
            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
            log.info(`[MapsScraper] Searching: ${searchUrl}`);
            
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Wait for list to load
            await page.waitForSelector('.m676Zc, .hfpxzc', { timeout: 10000 }).catch(() => log.warn('Maps selector timeout'));

            const leads = await page.evaluate(async (maxLeads) => {
                const results = [];
                const items = document.querySelectorAll('.hfpxzc'); // Each business link
                
                for (let i = 0; i < Math.min(items.length, maxLeads); i++) {
                    const item = items[i];
                    item.scrollIntoView();
                    const name = item.getAttribute('aria-label');
                    const link = item.getAttribute('href');
                    
                    results.push({ name, mapsUrl: link });
                }
                return results;
            }, limit);

            // Detailed scrape for each lead
            const detailedLeads = [];
            for (const lead of leads) {
                try {
                    log.info(`[MapsScraper] Fetching details for: ${lead.name}`);
                    await page.goto(lead.mapsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(1000);

                    const details = await page.evaluate(() => {
                        const getVal = (selector) => document.querySelector(selector)?.innerText?.trim() || 'N/A';
                        const getHref = (selector) => document.querySelector(selector)?.getAttribute('href') || 'N/A';
                        
                        // Selectors often change, using icons/labels is safer but hard in evaluate
                        // These are common selectors for Phone and Website
                        const phone = document.querySelector('button[data-item-id^="phone:"]')?.getAttribute('data-item-id')?.replace('phone:tel:', '') || 'N/A';
                        const website = document.querySelector('a[data-item-id="authority"]')?.getAttribute('href') || 'N/A';
                        const address = document.querySelector('button[data-item-id="address"]')?.innerText?.trim() || 'N/A';

                        return { phone, website, address };
                    });

                    detailedLeads.push({ ...lead, ...details });
                } catch (err) {
                    log.warn(`Failed to get details for ${lead.name}: ${err.message}`);
                    detailedLeads.push({ ...lead, phone: 'N/A', website: 'N/A', address: 'N/A' });
                }
            }

            await context.close();
            return detailedLeads;
        } catch (error) {
            await context.close();
            log.error('[MapsScraper] Fatal error:', error.message);
            throw error;
        }
    }
};
