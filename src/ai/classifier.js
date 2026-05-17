import { log } from '../utils/logger.js';

/**
 * Keyword-based Intent Classifier for free-chat AI routing
 * Determines which specialist model should handle the message
 */
const INTENT_KEYWORDS = {
    FRONTEND: [
        'css', 'html', 'react', 'vue', 'angular', 'svelte', 'tailwind',
        'component', 'layout', 'responsive', 'ui', 'ux', 'design',
        'animation', 'hover', 'transition', 'flexbox', 'grid', 'navbar',
        'sidebar', 'card', 'button style', 'dark mode', 'font', 'figma',
        'wireframe', 'landing page', 'frontend', 'front-end', 'tampilan'
    ],
    CODE: [
        'function', 'class', 'variable', 'array', 'loop', 'algorithm',
        'script', 'programming', 'syntax', 'compile', 'runtime', 'import',
        'export', 'async', 'await', 'promise', 'callback', 'typescript',
        'javascript', 'python', 'java', 'rust', 'golang', 'regex',
        'sorting', 'kode', 'bikin kode', 'buatkan kode', 'coding',
        'kodingan', 'program', 'logika', 'refactor'
    ],
    BACKEND: [
        'database', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql',
        'supabase', 'prisma', 'api', 'rest', 'graphql', 'server',
        'backend', 'middleware', 'endpoint', 'auth', 'jwt', 'token',
        'docker', 'kubernetes', 'microservice', 'architecture', 'schema',
        'migration', 'orm', 'query', 'arsitektur', 'scalable'
    ],
    DEBUG: [
        'debug', 'error', 'bug', 'stack trace', 'traceback', 'exception',
        'crash', 'fix', 'broken', 'not working', 'gagal', 'fail',
        'undefined', 'null', 'TypeError', 'ReferenceError', 'SyntaxError',
        'kenapa error', 'kok error', 'tidak bisa', 'gak jalan',
        'nggak jalan', 'perbaiki', 'tolong fix', 'kenapa gagal'
    ],
    TECH: [
        'linux', 'arch', 'ubuntu', 'debian', 'pacman', 'apt', 'systemd',
        'systemctl', 'config', 'konfigurasi', 'kernel', 'driver',
        'network', 'wifi', 'bluetooth', 'grub', 'kde', 'plasma', 'gnome',
        'bash', 'terminal', 'chmod', 'sudo', 'ssh', 'firewall', 'dns',
        'vpn', 'port', 'install', 'package', 'troubleshoot'
    ],
    AUTOMATION: [
        'volume', 'suara', 'kecilkan', 'besarkan', 'mute', 'unmute',
        'brightness', 'kecerahan', 'terang', 'gelap', 'layar',
        'screenshot', 'tangkapan layar', 'foto layar',
        'lock', 'kunci', 'suspend', 'tidur', 'sleep',
        'spotify', 'musik', 'lagu', 'putar', 'setel', 'jeda', 'pause',
        'next', 'skip', 'berikutnya', 'sebelumnya', 'previous',
        'clipboard', 'copy', 'salin', 'paste', 'tempel',
        'sys', 'system', 'pc', 'laptop', 'kontrol', 'atur'
    ],
    PROJECT: [
        'proyek', 'project', 'repo', 'repository', 'struktur', 'folder',
        'file', 'source code', 'kode sumber', 'isi file', 'baca file',
        'daftar file', 'arsitektur proyek', 'logic bot', 'cara kerja bot',
        'README', 'package.json', 'src/', 'index.js'
    ]
};

/**
 * Classify message intent using keyword scoring
 * @param {string} message - The user's message
 * @returns {string} Task category: FRONTEND, CODE, BACKEND, DEBUG, TECH, or GENERAL
 */
export const classifyIntent = (message) => {
    const lower = message.toLowerCase();
    const scores = {};

    for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
        scores[category] = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) scores[category]++;
        }
    }

    let best = 'GENERAL';
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            best = category;
        }
    }

    if (bestScore === 0) best = 'GENERAL';

    log.ai(`[Classifier] Intent: ${best} (score: ${bestScore})`);
    return best;
};

export default classifyIntent;
