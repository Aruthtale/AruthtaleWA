import dotenv from 'dotenv';
dotenv.config();

export const settings = {
    ownerNumber: (process.env.OWNER_NUMBER || '').trim(),
    authorizedNumbers: (process.env.AUTHORIZED_NUMBERS || '')
        .split(',')
        .map(num => num.trim().split('@')[0])
        .filter(num => num.length > 0),
    prefix: process.env.BOT_PREFIX || '!',
    botName: process.env.BOT_NAME || 'AI-WA-BOT',
    browserCookies: process.env.BROWSER_COOKIES || 'chrome',
    cookiesPath: process.env.COOKIES_PATH || null,
    
    // API Keys
    geminiKey: process.env.GEMINI_API_KEY,
    openRouterKey: process.env.OPENROUTER_API_KEY,
    kimiKey: process.env.KIMI_API_KEY,
    
    // Supabase
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    // Thresholds
    idleThreshold: parseInt(process.env.IDLE_THRESHOLD_MS) || 300000,
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD) || 85,
    ramThreshold: parseInt(process.env.RAM_THRESHOLD) || 85,
    gpuThreshold: parseInt(process.env.GPU_THRESHOLD) || 85,
    gpuTempThreshold: parseInt(process.env.GPU_TEMP_THRESHOLD) || 80,
    checkInterval: parseInt(process.env.CHECK_INTERVAL_MS) || 60000,

    // Spotify
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    spotifyUserId: process.env.SPOTIFY_USER_ID,
    systemPrompt: `Identitas: Kamu adalah Aruthtale, AI Linux Automation Assistant yang dikembangkan oleh Zennn dengan bantuan Antigravity.
Lingkungan: Kamu berjalan secara persisten sebagai systemd service di laptop EndeavourOS (Arch Linux) milik Zennn dengan desktop KDE Plasma.
Database & Memori: Kamu menggunakan Supabase sebagai database cloud untuk menyimpan memori percakapan jangka panjang.
Kemampuan Utama:
1. Kontrol Sistem: Screenshot desktop, monitoring suhu/CPU/RAM, eksekusi aplikasi Linux, serta kendali jarak jauh (Lock Screen !lock, Suspend !suspend, Volume !volume, Brightness !bright).
2. Developer Tools: Akses ke ~/Projects untuk memahami progres coding Zennn.
3. Media: Download video/slideshow otomatis (TikTok/IG/YT) dan kontrol Spotify.
4. Smart Utilities: Meringkas artikel web (!summary) dan membuat pengingat pintar (!remind).
5. Clipboard: Sinkronisasi clipboard otomatis untuk Owner.
Gaya Bicara: Teknis, cerdas, namun tetap ramah. Kamu adalah asisten elite yang tahu segala hal tentang sistem Zennn.
Aturan: Selalu jawab dalam Bahasa Indonesia. Jika ditanya soal fitur, arahkan user menggunakan perintah (!) yang sesuai.`
};

export default settings;
