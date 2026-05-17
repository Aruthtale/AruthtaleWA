import { exec } from 'child_process';
import { promisify } from 'util';
import { LINUX_ENV } from '../utils/system.js';

import { log } from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Robust execution helper that tries to find the best environment
 */
async function runSystemCommand(cmd) {
    const envVars = {
        ...process.env,
        DISPLAY: ':0',
        XDG_RUNTIME_DIR: `/run/user/${process.getuid()}`
    };
    
    // Try to find XAUTHORITY if not set
    if (!envVars.XAUTHORITY) {
        try {
            const { stdout } = await execAsync(`find /run/user/${process.getuid()}/ -name "xauth*" | head -n 1`);
            if (stdout.trim()) envVars.XAUTHORITY = stdout.trim();
        } catch (e) { /* ignore */ }
    }

    return await execAsync(cmd, { env: envVars });
}

export const systemControl = {
    /**
     * Lock the KDE Plasma session
     */
    lock: async () => {
        log.system('System: Locking session...');
        await runSystemCommand(`qdbus org.freedesktop.ScreenSaver /ScreenSaver Lock`);
    },

    /**
     * Suspend the system
     */
    suspend: async () => {
        log.info('System: Suspending...');
        await execAsync(`systemctl suspend`); // systemctl doesn't usually need DISPLAY
    },

    /**
     * Set system volume (0-100)
     */
    setVolume: async (level) => {
        const vol = Math.min(Math.max(parseInt(level), 0), 100);
        log.system(`Setting volume to ${vol}%`);
        
        const strategies = [
            `wpctl set-volume @DEFAULT_AUDIO_SINK@ ${vol}%`,
            `pactl set-sink-volume @DEFAULT_SINK@ ${vol}%`,
            `amixer sset Master ${vol}%`,
            `amixer -D pulse sset Master ${vol}%`,
            `amixer sset 'Master' ${vol}%`,
            `pw-volume set ${vol}%`
        ];

        let lastError = null;
        for (const cmd of strategies) {
            try {
                await runSystemCommand(cmd);
                log.info(`Volume set successfully via: ${cmd.split(' ')[0]}`);
                return vol;
            } catch (error) {
                lastError = error;
                log.warn(`Strategy ${cmd.split(' ')[0]} failed: ${error.message}`);
                continue;
            }
        }

        log.error('All volume control strategies failed', lastError.message);
        throw new Error('Gagal mengatur volume sistem. Pastikan PipeWire/PulseAudio berjalan.');
    },

    /**
     * Set screen brightness (0-100)
     */
    setBrightness: async (level) => {
        const bright = Math.min(Math.max(parseInt(level), 0), 100);
        log.system(`Setting brightness to ${bright}%`);
        
        const strategies = [
            `qdbus org.kde.Solid.PowerManagement /org/kde/Solid/PowerManagement/Actions/BrightnessControl setBrightness ${bright}`,
            `brightnessctl set ${bright}%`,
            `light -S ${bright}`,
            `xbacklight -set ${bright}`
        ];

        let lastError = null;
        for (const cmd of strategies) {
            try {
                await runSystemCommand(cmd);
                log.info(`Brightness set successfully via: ${cmd.split(' ')[0]}`);
                return bright;
            } catch (error) {
                lastError = error;
                continue;
            }
        }

        log.error('All brightness control strategies failed', lastError.message);
        throw new Error('Gagal mengatur kecerahan layar.');
    },

    /**
     * Sync text to KDE Clipboard (Klipper)
     */
    copyToClipboard: async (text) => {
        try {
            // Escape special characters for shell
            const escapedText = text.replace(/'/g, "'\\''");
            await runSystemCommand(`qdbus org.kde.klipper /klipper setClipboardContents '${escapedText}'`);
            log.info('System: Synced to clipboard.');
        } catch (error) {
            log.error('Clipboard sync error:', error.message);
        }
    }
};
