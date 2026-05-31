import { mapsScraper } from './mapsScraper.js';
import { searchService } from './searchService.js';
import { webReader } from './webReader.js';
import { googleService } from './googleService.js';
import { aiRouter } from '../ai/router.js';
import { log } from '../utils/logger.js';
import { db, insert, select } from './firebaseService.js';

export const leadService = {
    /**
     * Log a lead to Firestore
     */
    logLead: async (data) => {
        const { error } = await insert('leads', data);
        if (error) log.error(`[LeadService DB Error] ${error.message}`);
        return !error;
    },

    /**
     * Get leads from Firestore
     */
    getLeads: async (spreadsheetId = null) => {
        const filters = spreadsheetId ? [{ col: 'spreadsheet_id', op: '==', val: spreadsheetId }] : [];
        const { data, error } = await select('leads', filters);
        if (error) throw error;
        return data;
    },

    /**
     * Agentic Lead Generation V2
     * Real-time Maps Scraping, OSINT IG Finder, and Live Logging
     */
    execute: async (prompt, spreadsheetId, sock, remoteJid) => {
        log.info(`[LeadService V2] Executing for: ${prompt}`);
        
        // 1. Fase A: Parsing via AI (Hermes/Llama preferred for speed/cost)
        await sock.sendMessage(remoteJid, { text: "🔍 *Fase A: Dekonstruksi Perintah...*" });
        const parseResult = await aiRouter.route(`Ekstrak variabel pencarian dari: "${prompt}"
        Kembalikan JSON: {"query": "string pencarian maps", "limit": angka}`, { task: 'GENERAL' });

        let params;
        try {
            params = JSON.parse(parseResult.text.match(/{[\s\S]*}/)[0]);
        } catch (e) {
            params = { query: prompt, limit: 5 };
        }

        // 2. Fase B: Discovery via Real-time Maps Scraper
        await sock.sendMessage(remoteJid, { text: `🚀 *Fase B: Scraping Google Maps (${params.limit} target)...*` });
        const rawLeads = await mapsScraper.scrape(params.query, params.limit);

        // 3. Fase C: Investigation & Live Logging
        await sock.sendMessage(remoteJid, { text: `🕵️ *Fase C: Investigasi & Live Logging...*` });
        const finalResults = [];

        for (let i = 0; i < rawLeads.length; i++) {
            const lead = rawLeads[i];
            log.info(`[LeadService] Processing lead: ${lead.name}`);

            let instagram = 'N/A';
            let status = 'Prioritas Rendah';
            let notes = '';

            // OSINT Social Finder: If website is missing or basic (Linktree/Blogspot)
            const isBasicWeb = !lead.website || lead.website === 'N/A' || /linktr\.ee|blogspot|wordpress|site\.google/i.test(lead.website);
            
            if (isBasicWeb) {
                log.info(`[LeadService] Searching IG for: ${lead.name}`);
                try {
                    const igResults = await searchService.search(`site:instagram.com "${lead.name}" ${params.location || ''}`);
                    instagram = igResults[0]?.link || 'N/A';
                    
                    // Recursive Logic: If direct search fails but we have a phone number, try searching by phone
                    if (instagram === 'N/A' && lead.phone !== 'N/A') {
                        log.info(`[LeadService] Direct search failed, trying IG search by phone: ${lead.phone}`);
                        const igPhoneResults = await searchService.search(`site:instagram.com "${lead.phone}"`);
                        instagram = igPhoneResults[0]?.link || 'N/A';
                    }

                    status = (lead.website === 'N/A') ? '🚨 PRIORITAS UTAMA (No Website)' : '⚠️ PRIORITAS MENENGAH (Website Jadul)';
                    notes = (lead.website === 'N/A') ? 'Belum punya website resmi.' : 'Website masih menggunakan platform gratisan.';
                } catch (igErr) {
                    log.warn(`[LeadService] IG Search failed for ${lead.name}: ${igErr.message}`);
                    instagram = 'N/A';
                    status = (lead.website === 'N/A') ? '🚨 PRIORITAS UTAMA (No Website)' : '⚠️ PRIORITAS MENENGAH (Website Jadul)';
                    notes = 'Gagal mencari Instagram otomatis.';
                }
            } else {
                // Check if website is modern & TRY TO FIND IG IN WEBSITE
                try {
                    const content = await webReader.extractText(lead.website);
                    
                    // 1. Logic: Try to find Instagram link inside the website content
                    const igMatch = content.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
                    if (igMatch) {
                        instagram = `https://www.instagram.com/${igMatch[1]}`;
                        log.info(`[LeadService] Instagram found inside website: ${instagram}`);
                    } else {
                        // 2. Fallback: Search IG manually if not in website
                        const igResults = await searchService.search(`site:instagram.com "${lead.name}"`);
                        instagram = igResults[0]?.link || 'N/A';
                    }

                    const analysis = await aiRouter.route(`Analisis website ini modern atau outdated: ${lead.website}\nSnippet: ${content.substring(0, 500)}\nJSON: {"modern": boolean, "reason": "string"}`, { task: 'GENERAL' });
                    const result = JSON.parse(analysis.text.match(/{[\s\S]*}/)[0]);
                    if (!result.modern) {
                        status = '⚠️ PRIORITAS MENENGAH (Website Outdated)';
                        notes = result.reason;
                    } else {
                        status = 'Prioritas Rendah';
                        notes = 'Website sudah profesional.';
                    }
                } catch (err) {
                    status = '⚠️ PRIORITAS MENENGAH (Error)';
                    notes = 'Website tidak bisa diakses.';
                }
            }

            const processedLead = {
                name: lead.name,
                phone: lead.phone,
                website: lead.website,
                instagram: instagram,
                status: status,
                notes: notes,
                address: lead.address
            };

            // LIVE LOGGING: Save to Firestore
            await leadService.logLead({
                name: processedLead.name,
                phone: processedLead.phone,
                website: processedLead.website,
                instagram: processedLead.instagram,
                status: processedLead.status,
                spreadsheet_id: spreadsheetId
            });

            // LIVE LOGGING: Save to Google Sheets
            try {
                await googleService.appendSheet(spreadsheetId, [
                    processedLead.name,
                    processedLead.phone,
                    processedLead.instagram,
                    processedLead.website,
                    processedLead.status,
                    processedLead.notes
                ]);
            } catch (gsErr) {
                log.error(`[Sheets Error] ${gsErr.message}`);
            }

            // Send Real-time Progress to WA
            const waMsg = `✅ *[${i+1}/${rawLeads.length}] ${processedLead.name}*\n` +
                          `📞 Telp: ${processedLead.phone}\n` +
                          `📸 IG: ${processedLead.instagram !== 'N/A' ? processedLead.instagram : 'N/A'}\n` +
                          `🌐 Web: ${processedLead.website !== 'N/A' ? 'Ada' : '❌ TIDAK ADA'}\n` +
                          `📊 Status: ${processedLead.status}`;
            
            await sock.sendMessage(remoteJid, { text: waMsg });
            finalResults.push(processedLead);

            // Add delay to avoid rate limits (3-5 seconds)
            if (i < rawLeads.length - 1) {
                log.info('[LeadService] Waiting 3s before next lead...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        const summary = `🏁 *Tugas Selesai, Bos!*\n\n` +
                        `Berhasil mengumpulkan ${finalResults.length} leads.\n` +
                        `Link Sheets: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n\n` +
                        `*Tips:* Fokus ke label 🚨 *PRIORITAS UTAMA* untuk peluang closing tertinggi!`;

        await sock.sendMessage(remoteJid, { text: summary });
    }
};
