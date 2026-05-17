import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'temp', 'processed_messages.json');
const MAX_CACHE_SIZE = 500;

class MessageCache {
    constructor() {
        this.cache = new Set();
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                this.cache = new Set(data);
            }
        } catch (e) {
            this.cache = new Set();
        }
    }

    save() {
        try {
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            const data = Array.from(this.cache);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
        } catch (e) {
            // Ignore save errors
        }
    }

    has(id) {
        return this.cache.has(id);
    }

    add(id) {
        if (this.cache.has(id)) return;
        
        this.cache.add(id);
        if (this.cache.size > MAX_CACHE_SIZE) {
            const first = this.cache.values().next().value;
            this.cache.delete(first);
        }
        this.save();
    }
}

export const messageCache = new MessageCache();
