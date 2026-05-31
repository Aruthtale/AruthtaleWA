import { chromium } from 'playwright-chromium';
import { log } from '../utils/logger.js';

export const browserService = {
    browser: null,

    async init() {
        if (!this.browser) {
            try {
                this.browser = await chromium.launch({
                    headless: true,
                    executablePath: '/usr/bin/chromium',
                    args: [
                        '--no-sandbox', 
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                });
                log.info('Browser service initialized (Playwright with system Chromium)');
            } catch (error) {
                log.error('Failed to initialize browser service:', error);
                throw error;
            }
        }
    },

    /**
     * Scrape content from a URL with resource blocking to save RAM
     * @param {string} url 
     * @param {Object} options 
     * @returns {Promise<{text: string, title: string}>}
     */
    async scrape(url, options = {}) {
        await this.init();
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        if (options.lightweight) {
            await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf}', route => route.abort());
        }

        try {
            log.info(`Scraping (${options.lightweight ? 'Lightweight' : 'Full'}): ${url}`);
            // Use 'load' instead of 'networkidle' to prevent hanging on heavy sites
            const waitCondition = options.lightweight ? 'domcontentloaded' : 'load';
            
            await page.goto(url, { 
                waitUntil: waitCondition, 
                timeout: 20000 // Reduced from 30s to 20s
            });
            
            // Wait for 1 second just in case of animations/late renders
            await page.waitForTimeout(1000);

            const title = await page.title();
            
            const text = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script, style, nav, footer, header, ads, .ads, #ads');
                scripts.forEach(s => s.remove());
                return document.body.innerText;
            });

            await context.close();
            return { 
                text: text.replace(/\s+/g, ' ').trim().slice(0, 15000), 
                title 
            };
        } catch (error) {
            await context.close();
            log.error(`Scraping error for ${url}:`, error.message);
            throw error;
        }
    },

    /**
     * Take a screenshot of a website
     * @param {string} url 
     * @returns {Promise<Buffer>}
     */
    async screenshot(url) {
        await this.init();
        const context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 2 // Higher quality
        });
        const page = await context.newPage();

        try {
            log.info(`Taking screenshot: ${url}`);
            // Use 'load' first as it's more reliable than 'networkidle' for many sites
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            
            // Try to wait for network idle but don't fail if it timeouts
            try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
            } catch (e) {
                log.warn(`Network not idle for ${url}, proceeding anyway...`);
            }

            await page.waitForTimeout(2000); // Final wait for animations
            const buffer = await page.screenshot({ 
                type: 'png',
                fullPage: false 
            });
            
            await context.close();
            return buffer;
        } catch (error) {
            await context.close();
            log.error(`Screenshot failed for ${url}:`, error.message);
            throw error;
        }
    },

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
};
