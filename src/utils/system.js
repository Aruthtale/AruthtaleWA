import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from './logger.js';

const execAsync = promisify(exec);

// Linux environment variables for GUI apps, including XAUTHORITY for X11 compatibility
export const LINUX_ENV = 'DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/$(id -u) XAUTHORITY=$(find /run/user/$(id -u)/ -name "xauth*" | head -n 1)';

/**
 * Launch a Linux application using multiple strategies
 * @param {string} appName - Name of the application to launch
 * @returns {Promise<{success: boolean, cmd: string, error: string}>}
 */
export async function launchApp(appName) {
    const binaryName = appName.toLowerCase().replace(/\s+/g, '-');
    
    const strategies = [
        `${LINUX_ENV} nohup ${binaryName} &`,
        `${LINUX_ENV} gtk-launch ${binaryName}`,
        `${LINUX_ENV} kstart --command ${binaryName}`,
        `${LINUX_ENV} dex -a ${binaryName} > /dev/null 2>&1 &`
    ];

    // Special handling for Spotify on Arch and other distros
    if (binaryName === 'spotify') {
        strategies.unshift(`${LINUX_ENV} spotify-launcher &`);
        strategies.unshift(`${LINUX_ENV} xdg-open spotify:// > /dev/null 2>&1 &`);
        strategies.push(`${LINUX_ENV} flatpak run com.spotify.Client &`);
        strategies.push(`${LINUX_ENV} snap run spotify &`);
    }

    let lastError = '';
    
    for (const cmd of strategies) {
        try {
            await new Promise((resolve, reject) => {
                // Use a short timeout for commands that might hang
                const process = exec(`${cmd} > /dev/null 2>&1`, (err) => {
                    // nohup always "fails" or behaves weirdly in exec, so we treat it carefully
                    if (err && !cmd.includes('nohup') && !cmd.includes('&')) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                
                // For background commands, we resolve quickly
                if (cmd.includes('&') || cmd.includes('nohup')) {
                    setTimeout(resolve, 500);
                }
            });
            
            log.info(`Successfully processed launch command for ${appName}: ${cmd}`);
            return { success: true, cmd };
        } catch (err) {
            lastError = err.message;
            continue;
        }
    }
    
    return { success: false, error: lastError };
}
