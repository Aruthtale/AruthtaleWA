/**
 * Sanitizes and validates a URL to prevent command injection
 * @param {string} url 
 * @returns {string}
 */
export const sanitizeUrl = (url) => {
    if (!url) return '';
    
    // Remove any whitespace
    let sanitized = url.trim();
    
    // Simple validation: must start with http or https
    if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
        throw new Error('❌ URL harus diawali dengan http:// atau https://');
    }
    
    // Prevent shell characters from breaking out
    // yt-dlp usually handles arguments well if quoted, but better safe
    sanitized = sanitized.replace(/[;&|`$<>]/g, '');
    
    return sanitized;
};
