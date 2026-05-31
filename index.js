import { connectToWhatsApp } from './src/services/whatsapp.js';
import { log } from './src/utils/logger.js';
import { startIdleWatcher } from './src/watchers/idleWatcher.js';
import { startResourceWatcher } from './src/watchers/resourceWatcher.js';
import { cleanupService } from './src/services/cleanup.js';
import { healthService } from './src/system/health.js';
import { alertService } from './src/watchers/alertService.js';
import { backupService } from './src/workers/backupWorker.js';
import { dashboardService } from './src/server/dashboard.js';
import { firebaseBridge } from './src/services/firebaseBridge.js';

const start = async () => {
    try {
        log.system('Initializing AI-WA-BOT...');
        
        // 1. Connect to WhatsApp
        const sock = await connectToWhatsApp();
        
        // 1.5 Start Firebase Bridge
        firebaseBridge.listenToFlutterCommands(sock);
        
        // 2. Start Automation Watchers
        startIdleWatcher(sock);
        startResourceWatcher(sock);
        
        // 3. Start Auto-Cleanup, Health, & Alert Services
        cleanupService.init();
        healthService.initGracefulShutdown(sock);
        alertService.init(sock);
        backupService.init();
        dashboardService.init();
        
        // 4. Start Reminder & Automation Services
        const { reminderService } = await import('./src/services/reminderService.js');
        const { automationService } = await import('./src/services/automationService.js');
        
        reminderService.init(sock);
        automationService.init(sock);
        
        log.success('AI-WA-BOT is now running and monitoring your system.');

    } catch (error) {
        log.error('Fatal Initialization Error:', error);
        process.exit(1);
    }
};

// Handle process errors to prevent crash
process.on('uncaughtException', (err) => {
    log.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();
