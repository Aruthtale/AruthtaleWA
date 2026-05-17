import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

const PROJECTS_ROOT = '/home/zennrch/Projects';

export const knowledgeService = {
    // Mencari semua file dokumentasi penting di folder Projects
    getProjectsSummary: async () => {
        try {
            if (!fs.existsSync(PROJECTS_ROOT)) return "Folder Projects tidak ditemukan.";

            const projects = fs.readdirSync(PROJECTS_ROOT);
            let summary = "Berikut adalah daftar proyek yang kamu miliki di ~/Projects:\n\n";

            for (const project of projects) {
                const projectPath = path.join(PROJECTS_ROOT, project);
                if (fs.statSync(projectPath).isDirectory()) {
                    summary += `📁 *${project}*\n`;
                    
                    // Cek README atau TODO
                    const docs = ['README.md', 'README', 'TODO.md', 'information.md'];
                    for (const doc of docs) {
                        const docPath = path.join(projectPath, doc);
                        if (fs.existsSync(docPath)) {
                            const content = fs.readFileSync(docPath, 'utf8').substring(0, 300); // Ambil 300 karakter pertama
                            summary += `   📄 ${doc}: ${content.replace(/\n/g, ' ').substring(0, 100)}...\n`;
                            break; 
                        }
                    }
                    summary += "\n";
                }
            }
            return summary;
        } catch (error) {
            log.error('Knowledge Service Error:', error.message);
            return "Gagal memuat pengetahuan proyek.";
        }
    },

    // Membaca konten lengkap dari file dokumentasi proyek tertentu
    getProjectDetail: async (projectName) => {
        try {
            const projectPath = path.join(PROJECTS_ROOT, projectName);
            if (!fs.existsSync(projectPath)) return "Proyek tidak ditemukan.";

            const docs = ['README.md', 'TODO.md', 'information.md', 'package.json'];
            let detail = `--- DETAIL PROYEK: ${projectName} ---\n\n`;

            for (const doc of docs) {
                const docPath = path.join(projectPath, doc);
                if (fs.existsSync(docPath)) {
                    const content = fs.readFileSync(docPath, 'utf8');
                    detail += `[FILE: ${doc}]\n${content}\n\n`;
                }
            }
            return detail;
        } catch (error) {
            return `Gagal membaca detail proyek: ${error.message}`;
        }
    }
};
