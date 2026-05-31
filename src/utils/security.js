/**
 * Security filter to detect common prompt injection patterns
 * and sanitize user input for system commands.
 */
export const securityFilter = {
    // Limits input length to prevent DoS via excessively large strings
    MAX_INPUT_LENGTH: 1000,

    /**
     * Check if a message contains potential prompt injection attempts
     * @param {string} text 
     * @returns {boolean} true if malicious
     */
    isPromptInjection: (text) => {
        if (!text) return false;
        if (text.length > securityFilter.MAX_INPUT_LENGTH) return true;
        
        const patterns = [
            /ignore all previous instructions/i,
            /disregard previous instructions/i,
            /you are now a/i,
            /jailbreak/i,
            /DAN mode/i,
            /system prompt/i,
            /bypass filtering/i,
            /forget everything/i,
            /hack/i,
            /get root/i,
        ];

        return patterns.some(pattern => pattern.test(text));
    },

    /**
     * Strictly sanitize input for shell execution.
     * Uses a whitelist approach: Only allow alfanumeric, spaces, dashes, and underscores.
     */
    sanitizeShell: (input) => {
        if (typeof input !== 'string') return '';
        // Only allow alfanumeric, spaces, dashes, and underscores. 
        // Anything else is stripped.
        return input.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    }
};

export default securityFilter;
