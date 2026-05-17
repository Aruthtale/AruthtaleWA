# 🤖 AI-WA-BOT

**AI-WA-BOT** adalah asisten pengembang dan otomasi Linux berbasis WhatsApp yang dirancang khusus untuk **Arch Linux / EndeavourOS** dengan environment **KDE Plasma Wayland**.

Bot ini berjalan sebagai layanan latar belakang (*background service*) yang membantu Anda memantau sistem, melakukan tugas otomasi, dan memberikan bantuan coding melalui AI.

## ✨ Fitur Utama

- 🧠 **Multi-Model AI:** Menggunakan Gemini 1.5 Pro sebagai otak utama dengan fallback otomatis ke OpenRouter (Qwen/DeepSeek) jika terjadi blokir keamanan.
- 📸 **Otomasi Screenshot:** Menggunakan `grim` untuk mengambil screenshot desktop Wayland Anda secara manual atau otomatis.
- ⏳ **Idle Monitoring:** Deteksi otomatis saat sistem tidak aktif via KDE DBus.
- ⚡ **Resource Watcher:** Notifikasi WhatsApp jika penggunaan CPU atau RAM terlalu tinggi.
- 🔋 **System Health:** Cek status baterai dan kondisi sistem via perintah WhatsApp.
- 🔒 **Security:** Whitelist ketat hanya untuk nomor pemilik.
- ⚙️ **Systemd Integration:** Berjalan sebagai *user service* yang persisten.

## 🛠️ Persyaratan Sistem (Linux)

Pastikan dependensi berikut terinstal di sistem Arch/EndeavourOS Anda:

```bash
sudo pacman -S grim qdbus nodejs npm
```

## 🚀 Instalasi

1. **Clone & Install Dependencies:**
   ```bash
   cd ~/Projects/ai-wa-bot
   npm install
   ```

2. **Konfigurasi Environment:**
   Salin `.env` dan isi kredensial Anda:
   ```bash
   # Masukkan API Key dan nomor WhatsApp Anda (format: 628xxx@s.whatsapp.net)
   nano .env
   ```

3. **Jalankan Bot:**
   ```bash
   npm start
   ```
   *Scan QR code yang muncul di terminal menggunakan aplikasi WhatsApp Anda.*

## 📂 Struktur Proyek

- `src/ai/`: Provider Gemini & OpenRouter dengan logika fallback.
- `src/automation/`: Pengamat sistem (Idle, Resource, dll).
- `src/commands/`: Logika perintah WhatsApp (`!ask`, `!screenshot`, `!system`).
- `src/services/`: Integrasi WhatsApp dan penanganan pesan.
- `systemd/`: Template file service untuk Linux.

## 🖥️ Systemd Setup (Otomatis Jalankan di Background)

Untuk menjalankan bot secara otomatis saat login:

```bash
mkdir -p ~/.config/systemd/user/
cp systemd/ai-wa-bot.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable ai-wa-bot.service
systemctl --user start ai-wa-bot.service
```

## 📝 Daftar Perintah

- `!ask <pertanyaan>`: Tanya asisten AI.
- `!screenshot`: Ambil screenshot desktop sekarang.
- `!system`: Laporan kondisi CPU, RAM, dan Baterai.
- `!summary`: (Segera Hadir) Rangkuman memori via Supabase.

---
**Build with ❤️ by Antigravity**
