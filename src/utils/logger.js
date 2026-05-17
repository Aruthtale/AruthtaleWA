import pino from 'pino';
import chalk from 'chalk';

// --- CONFIGURASI PINO ---
const logger = pino({
    level: 'info',
    base: null, // Menghapus pid dan hostname untuk tampilan lebih bersih
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{msg}'
        }
    }
});

// --- WRAPPER LOG TERSTRUKTUR ---
export const log = {
    // Log Umum
    info: (msg) => logger.info(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => logger.info(chalk.green(`✓ [SUCCESS] ${msg}`)),
    warn: (msg) => logger.warn(chalk.yellow(`! [WARN] ${msg}`)),
    
    // Log Error dengan Stack Trace
    error: (msg, err) => {
        const errorMsg = err?.stack || err?.message || err || 'Unknown Error';
        logger.error({ err }, chalk.red(`✘ [ERROR] ${msg}`));
        if (err) console.error(chalk.red.dim(errorMsg));
    },

    // Log Kategori Khusus (Struktural)
    ai: (msg) => logger.info({ category: 'AI' }, chalk.cyan(`[AI] ${msg}`)),
    spotify: (msg) => logger.info({ category: 'SPOTIFY' }, chalk.greenBright(`[SPOTIFY] ${msg}`)),
    wa: (msg) => logger.info({ category: 'WHATSAPP' }, chalk.green(`[WA] ${msg}`)),
    system: (msg) => logger.info({ category: 'SYSTEM' }, chalk.magenta(`[SYSTEM] ${msg}`)),
    automation: (msg) => logger.info({ category: 'AUTOMATION' }, chalk.yellowBright(`[AUTOMATION] ${msg}`)),
    memory: (msg) => logger.info({ category: 'MEMORY' }, chalk.whiteBright(`[MEMORY] ${msg}`)),
};

export default log;
