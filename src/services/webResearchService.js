import * as cheerio from 'cheerio';
import { log } from '../utils/logger.js';
import { aiProvider } from '../ai/provider.js';
import { browserService } from './browserService.js';

export const webResearchService = {
    /**
     * Melakukan pencarian di DuckDuckGo dan men-scrape konten utama website
     * @param {string} query - Kata kunci pencarian
     * @param {number} maxResults - Jumlah link yang akan dibuka (default: 3)
     */
    searchWeb: async (rawQuery, maxResults = 3) => {
        try {
            // NLP Dasar: Bersihkan query dari kata-kata percakapan agar mesin pencari akurat
            const stopwords = ['coba', 'tolong', 'carikan', 'cari', 'berita', 'tentang', 'tahu', 'kasih', 'info', 'dong', 'yang', 'sedang', 'akhir', 'kahir', 'ini', 'hari', 'sekarang', 'saat', 'buatkan', 'carik', 'tolongin'];
            let query = rawQuery;
            stopwords.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                query = query.replace(regex, '');
            });
            query = query.replace(/\s+/g, ' ').trim();
            if (query.length < 2) query = rawQuery; // Fallback jika query jadi kosong
            
            log.info(`[WebResearch] Searching Yahoo Search for: "${query}" (Original: "${rawQuery}")`);
            
            // Custom scraper for Yahoo Search (Lebih stabil dari DuckDuckGo dan Google)
            const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            const searchHtml = await response.text();
            
            const _$ = cheerio.load(searchHtml);
            const topResults = [];
            
            _$('.algo').each((i, el) => {
                if (i >= maxResults) return false;
                const title = _$(el).find('h3').text().trim() || _$(el).find('a').attr('aria-label') || '';
                let url = _$(el).find('a').attr('href');
                const description = _$(el).find('.compText, .fc-falcon').text().trim();
                
                // Clean up Yahoo redirect URLs
                if (url && url.includes('/RU=')) {
                    try {
                        const extracted = url.split('/RU=')[1].split('/RK=')[0];
                        url = decodeURIComponent(extracted);
                    } catch (e) {
                        // Keep original if parsing fails
                    }
                }
                
                if (title && url) {
                    topResults.push({ title, url, description });
                }
            });
            
            if (topResults.length === 0) {
                return "Tidak ada hasil pencarian ditemukan.";
            }
            
            let researchData = `PENCARIAN WEB UNTUK: "${query}"\n\n`;
            
            for (let i = 0; i < topResults.length; i++) {
                const res = topResults[i];
                researchData += `SUMBER ${i+1}:\nJudul: ${res.title}\nURL: ${res.url}\nDeskripsi: ${res.description}\n`;
                
                // Try to scrape actual page content for deep research
                try {
                    log.info(`[WebResearch] Deep scraping: ${res.url}`);
                    const result = await browserService.scrape(res.url);
                    let text = result.text;
                    
                    // Batasi panjang teks per halaman agar token tidak membludak (max 6000 chars)
                    if (text.length > 6000) text = text.substring(0, 6000) + '... [TERPOTONG]';
                    
                    researchData += `KONTEN HALAMAN:\n${text}\n\n`;
                } catch (e) {
                    log.warn(`[WebResearch] Gagal men-scrape ${res.url}: ${e.message}`);
                    researchData += `(Gagal membaca website ini secara mendalam. Menggunakan ringkasan bawaan mesin pencari)\n\n`;
                }
            }
            
            return researchData;
        } catch (error) {
            log.error(`[WebResearch] Error: ${error.message}`);
            throw error;
        }
    },

    /**
     * Menjalankan proses riset end-to-end (Pencarian -> AI -> Laporan)
     */
    generateReport: async (query, isDeepResearch = false) => {
        // Deep research membaca 5 link, normal research membaca 2 link
        const maxLinks = isDeepResearch ? 5 : 2; 
        const rawData = await webResearchService.searchWeb(query, maxLinks);
        
        const systemPrompt = `Kamu adalah Agen Riset Web (Web Research Agent). Tugasmu adalah membaca data hasil pencarian web terbaru di bawah ini dan menyusun laporan yang informatif, akurat, ringkas, dan terstruktur untuk pengguna.
ATURAN PENTING:
1. Gunakan HANYA informasi yang ada dalam data pencarian berikut.
2. Jika data pencarian tidak menjawab pertanyaan, katakan kamu tidak menemukan informasinya. JANGAN MENGARANG FAKTA.
3. Selalu cantumkan referensi sumber URL di akhir laporanmu (misal: "Sumber: [1] URL, [2] URL").
4. Berikan format yang enak dibaca di WhatsApp (gunakan *, _, dan emoji).

DATA HASIL PENCARIAN WEB:
${rawData}`;

        // Kirim raw data ke router AI kita (Tugas GENERAL untuk memanggil Gemini/Llama 70B)
        const response = await aiProvider.chat(`Tolong buatkan laporan riset tentang: ${query}`, {
            systemInstruction: systemPrompt,
            task: 'GENERAL' 
        });

        return response;
    }
};
