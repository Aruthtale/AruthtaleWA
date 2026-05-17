/**
 * Simple security filter to detect common prompt injection patterns
 * and malicious command attempts.
 */
export const securityFilter = {
    /**
     * Check if a message contains prompt injection attempts
     * @param {string} text 
     * @returns {boolean} true if malicious
     */
    isPromptInjection: (text) => {
        if (!text) return false;
        
        const patterns = [
            /ignore all previous instructions/i,
            /disregard previous instructions/i,
            /you are now a/i,
            /jailbreak/i,
            /DAN mode/i,
            /system prompt/i,
            /bypass filtering/i,
            /forget everything/i,
            /\b(sudo|rm -rf|mkfs|shutdown|reboot)\b/i, // Basic command protection
        ];

        return patterns.some(pattern => pattern.test(text));
    },

    /**
     * Sanitize input for shell execution (used in fsTools/systemControl)
     */
    sanitizeShell: (input) => {
        if (typeof input !== 'string') return '';
        // Remove potentially dangerous shell characters
        return input.replace(/[;&|`$()>]/g, '');
    }
};

export default securityFilter;
