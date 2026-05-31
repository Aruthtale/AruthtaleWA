import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../utils/logger.js';
import { browserService } from './browserService.js';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export const osintService = {
    /**
     * Domain Investigator: WHOIS, DNS, and Basic Port Scan
     */
    investigateDomain: async (domain) => {
        log.info(`[OSINT] Investigating domain: ${domain}`);
        const results = {
            whois: 'N/A',
            dns: [],
            ports: []
        };

        try {
            // 1. WHOIS
            const { stdout: whoisOut } = await execAsync(`whois ${domain} | grep -E "Registrar:|Creation Date:|Expiry Date:|Name Server:" | head -n 10`);
            results.whois = whoisOut.trim() || 'No WHOIS data found.';

            // 2. DNS (Dig)
            const { stdout: dnsOut } = await execAsync(`dig ${domain} ANY +short`);
            results.dns = dnsOut.trim().split('\n').filter(Boolean);

            // 3. Basic Port Scan (Nmap - fast scan)
            const { stdout: nmapOut } = await execAsync(`nmap -F ${domain} | grep "open"`);
            results.ports = nmapOut.trim().split('\n').filter(Boolean);

            return results;
        } catch (error) {
            log.error(`[OSINT] Investigation failed for ${domain}:`, error.message);
            throw error;
        }
    },

    /**
     * Visual Web Scraper: Take a screenshot and return the path
     */
    captureScreenshot: async (url) => {
        log.info(`[Scraper] Capturing screenshot via browserService: ${url}`);
        const fileName = `screenshot_${Date.now()}.png`;
        const tempDir = path.join(process.cwd(), 'temp');
        const filePath = path.join(tempDir, fileName);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const buffer = await browserService.screenshot(url);
            fs.writeFileSync(filePath, buffer);
            return filePath;
        } catch (error) {
            log.error(`[Scraper] Failed to capture ${url}:`, error.message);
            throw error;
        }
    }
};
