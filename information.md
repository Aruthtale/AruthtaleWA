# 🤖 Aruthtale AI Assistant Documentation

Aruthtale adalah asisten AI berbasis WhatsApp yang dirancang khusus untuk berjalan secara persisten menggunakan `systemd` pada lingkungan EndeavourOS (KDE Plasma). Bot ini menggabungkan otomasi Linux, manajemen media, dan fitur AI tingkat lanjut.

---

## 🛠️ DAFTAR PERINTAH LAMA & ASLI

### 🛡️ Admin & Akses (Owner Only)
- `!admin menu` : Membuka panel kontrol administratif.
- `!auth add <nomor>` : Menambahkan nomor ke daftar User Terverifikasi (Authorized User).
- `!stats` : Melihat statistik bot, penggunaan CPU, RAM, dan status database.
- `!usage` : Melihat statistik penggunaan kuota AI (token/download).
- `!backup` : Melakukan backup data bot ke archive `tar.gz`.

### 💻 Kontrol Sistem Linux (Owner Only)
- `!volume <0-100>` / `!vol` : Mengatur volume audio laptop.
- `!bright <0-100>` : Mengatur kecerahan layar laptop.
- `!lock` : Mengunci sesi layar KDE Plasma.
- `!suspend` / `!sleep` : Mengalihkan laptop ke mode tidur/suspend.
- `!screenshot` / `!ss` : Mengambil tangkapan layar desktop saat ini.
- `!copy` / `!cp` : Menyinkronkan teks ke clipboard laptop.
- `!open <aplikasi>` : Menjalankan aplikasi GUI Linux.
- `!audit` / `!doctor` / `!health` : Melakukan diagnosa kesehatan sistem.

### 🧠 Fitur AI & Produktivitas
- `!ask <pertanyaan>` : Tanya jawab umum dengan asisten AI.
- `!gen <prompt>` : Membuat/generate gambar menggunakan AI (Multi-model fallback).
- `!edit <deskripsi>` : Mengedit gambar menggunakan AI (balas/reply gambar).
- `!explain` : Meminta AI menjelaskan topik secara detail.
- `!ocr` : Ekstrak dan baca teks dari gambar (balas gambar).
- `!summary <url>` : Meringkas inti sari dari artikel di website.
- `!search <query>` : Pencarian data real-time ke internet.
- `!remind <waktu> <pesan>` : Menjadwalkan pengingat otomatis.
- `!code` / `!debug` : Membantu menganalisa dan memperbaiki kode (Dev Mode).

### 🎬 Media & Downloader
- `!dl <url>` : Mengunduh video/media dari berbagai platform (TikTok, IG, YT).
- `!mp3 <url>` : Mengunduh audio YouTube dengan metadata.
- `!spotify <judul>` : Mencari lagu di Spotify.
- `!img <query>` : Mencari gambar via Google Image.
- `!myid` : Mengecek ID WhatsApp pengguna.
- `!menu` : Menampilkan daftar perintah yang tersedia.

---

## 📡 FITUR MONITORING & SISTEM OTOMATIS (LAMA)

1. **Auto-Downloader**: 
   Jika pengguna mengirim link TikTok, Instagram, atau YouTube secara langsung, bot akan otomatis mengunduh medianya tanpa perlu mengetik `!dl`.
2. **Proactive Healer (Alert System)**: 
   Sistem pemantau performa yang berjalan di latar belakang. Jika penggunaan CPU atau RAM melebihi 85%, bot akan mengirim notifikasi darurat via WhatsApp beserta opsi *"Kill Process"*.
3. **Idle Watcher**: 
   Jika laptop mendeteksi tidak ada aktivitas keyboard/mouse selama lebih dari 5 menit, bot akan menganggap laptop sedang *idle* dan mengirimkan screenshot kondisi layar terakhir.
4. **Security Confirmation**: 
   AI dilarang keras mengubah file di sistem operasi. Sebelum mengeksekusi `fsTools.write_file`, AI wajib meminta konfirmasi manual dari Zen (Owner).
5. **Daily Briefing Pagi (07:00 WIB)**: 
   Bot mengirimkan ringkasan pagi ke Owner yang mencakup kondisi cuaca terkini, daftar jadwal/todo dari **Google Calendar** dan **Google Tasks**, serta pesan motivasi dari AI.
6. **Auto-Summary & Status Report (Setiap 2 Jam)**: 
   Bot secara otomatis memantau performa hardware (CPU, RAM, GPU) dan memberikan ringkasan singkat aktivitas percakapan yang terjadi dalam 2 jam terakhir.
7. **Google Integration (Owner Only)**:
   Mendukung sinkronisasi penuh dengan ekosistem Google. Owner dapat menambah tugas ke Google Tasks (`!todo`) dan agenda ke Google Calendar (`!jadwal`) langsung dari chat.
8. **Voice-to-Command Restriction**:
   Hanya **Owner** yang memiliki izin untuk mengirimkan pesan suara (Voice Note) yang akan diproses otomatis menjadi perintah sistem. User lain hanya bisa melakukan transkrip tanpa eksekusi perintah.
9. **LINE Sticker Pack Downloader**:
   Mendukung pengunduhan seluruh paket stiker dari LINE Store menggunakan perintah `!linestiker <link>`. Bot akan otomatis mengonversi gambar ke format stiker WhatsApp dan mengirimkannya secara masal.

---
---

## 🚀 PEMBARUAN TERBARU (v3.5.0)
*(Ditambahkan tanpa menghapus fungsionalitas lama)*

1. **Konsolidasi Perintah (!sys)**:
   Perintah sistem kini bisa dipanggil lewat satu pintu untuk lebih rapi (contoh: `!sys vol 50`, `!sys lock`, `!sys ss`). *Perintah lama seperti `!vol` tetap berfungsi sebagai alias.*
2. **Voice Note Transcription**:
   Pengguna kini bisa mengirim **Pesan Suara (Audio)**. Bot akan otomatis mentranskripsikan suara menjadi teks menggunakan Gemini, dan menjalankan perintah jika teks tersebut berupa instruksi sistem (misal: "tolong screenshot").
3. **Multi-Language Detection**:
   Sistem pintar yang bisa mendeteksi penggunaan Bahasa Indonesia (dengan gaya kasual/Toss) atau Bahasa Inggris (Professional) secara otomatis berdasarkan pesan pengguna.
4. **Usage Quota Tracking**:
   Setiap penggunaan token AI dan besaran file unduhan (MB) dicatat per-pengguna ke database Supabase (`usage_log`). Total harian dapat dilihat via `!stats`.
5. **Hot Reload (!reload)**:
   Perintah baru khusus Owner untuk memperbarui modul kode bot secara instan tanpa perlu mematikan dan merestart service systemd.
6. **Ping Test (!ping)**:
   Perintah baru khusus Owner untuk mengecek responsivitas/latency dari API Gemini, OpenRouter, dan database Supabase.

---

## 🌐 DISTRIBUTED AI ROUTING (v4.0.0)
*(Sistem "Pakar Terdistribusi" - Otomatis memilih AI terbaik untuk tugas spesifik)*

1. **Fully Distributed Architecture**:
   Aruthtale tidak lagi hanya bergantung pada satu AI. Setiap pesan kini dianalisis oleh **Intent Classifier** dan diarahkan ke model "Pakar" yang paling kompeten di bidangnya melalui OpenRouter.

2. **Daftar Pakar & Spesialisasi**:
   - 🎨 **Frontend & UI/UX**: *Gemini 3 Flash Preview* & *Gemma 4 31B* (Estetika tinggi & CSS bersih).
   - ⚙️ **Backend & Logic**: *Hermes 3 405B Instruct* & *Llama 3.3 70B* (Arsitektur & logika berat).
   - 💻 **Pure Coding (!code)**: *GLM 4.5 Air* (Akurasi algoritma & efisiensi).
   - 🔍 **Debugging (!debug)**: *LFM2.5-1.2B-Thinking* (Analisis error langkah-demi-langkah).
   - 🐧 **Linux & Tech Support**: *Nemotron 3 Super* & *Riverflow V2 Max* (Konfigurasi sistem & troubleshooting).
   - 👁️ **Vision & OCR (!ocr)**: *Gemini 3.1 Flash Image Preview* (Analisis gambar tingkat lanjut).

3. **Smart Fallback System**:
   Jika model pakar mengalami gangguan atau *rate limit*, sistem akan otomatis mencoba model cadangan dalam hitungan milidetik. **Gemini 3 Flash Preview** bertindak sebagai *Ultimate Safety Net* jika semua model OpenRouter gagal.

4. **Auto-Intent Detection**:
   Untuk chat biasa (tanpa perintah `!`), bot secara cerdas mendeteksi apakah kamu sedang membahas koding, UI, atau masalah sistem, lalu merespon menggunakan model yang paling sesuai tanpa kamu perlu mengaturnya secara manual.

---
*Created with ❤️ by Zen & Antigravity*


---

## ✨ FITUR BARU (v5.0.0)
*(Ditambahkan 15 Mei 2026)*

### 🖼️ Media Commands Baru
| Perintah | Fungsi | Akses |
|---|---|---|
| `!stiker` | Buat stiker WA dari gambar/video (balas media) | Authorized |
| `!removebg` | Hapus background foto (balas foto) | Authorized |
| `!transkrip` | Ubah Voice Note/Audio/Video jadi teks | Authorized |
| `!qr [teks]` | Buat QR Code dari teks atau link | Owner |
| `!dl` / `!img` | Kini mendukung Pinterest | Public |

**Catatan `!removebg`:** Butuh API Key gratis dari remove.bg (50 gambar/bulan gratis).
Tambahkan ke `.env`: `REMOVEBG_API_KEY=your_key_here`

### 🎙️ Multi-Modal & Media Evolution (New!)
| Perintah | Fungsi | Akses |
|---|---|---|
| `!vsticker` | Ubah video/link (YT/TikTok) jadi sticker bergerak | Authorized |
| `Voice-to-Voice` | Kirim VN dibalas VN (Persona Suara Natural) | Owner |
| `!mood` | Analisis psikologis & mood seminggu terakhir | Owner |
| `Nightly Journal` | Sapaan otomatis jam 22:00 untuk refleksi harian | Owner |

### 🧠 Peningkatan AI & Performa
- **AI Voice Persona** — Respon suara natural untuk interaksi hands-free.
- **Cache Jawaban AI** — Pertanyaan sama tidak konsumsi token (cache 30 menit).
- **Embedding Cache Lokal** — RAG/memori semantik lebih cepat, hemat kuota API.
- **Anti Prompt Injection** — Filter otomatis blokir upaya jailbreak/manipulasi.
- **Typing Indicator** — Bot tampilkan "mengetik..." saat memproses.
- **Token Budget Enforcement** — User melampaui batas diblokir sementara (50K token / 1GB download / 10 gambar/hari).

### 🎭 Manajemen Memori & Persona (Owner Only)
| Perintah | Fungsi | Akses |
|---|---|---|
| `!persona [deskripsi]` | Ganti kepribadian AI untuk sesi Anda | Owner |
| `!persona reset` | Kembalikan persona ke default | Owner |
| `!history [n]` | Lihat N pesan terakhir (default 5, max 10) | Owner |
| `!clearchat` | Hapus seluruh riwayat memori bot | Owner |

### 🔧 Tooling & Infrastruktur (v6.0 Stability)
- **Cloud Logging** — Semua log audit kini tersinkronisasi ke Supabase.
- **Proactive Alerts** — Notifikasi otomatis ke Owner jika API/DB bermasalah.
- **Aggressive Cleanup** — Auto-hapus file sampah setiap 1 jam (max age 2 jam).
- **Execution Timeout** — Safeguard 120 detik per perintah untuk cegah hang.

---
*Updated with ❤️ by Zen & Antigravity — v6.0.0 (Stability & Voice Update)*

---

## 🔧 PEMBARUAN TERBARU (v5.1.0)
*(Ditambahkan 15 Mei 2026 - Fokus: Infrastruktur & Sinkronisasi)*

### 🛠️ Fitur Administrasi Baru
| Perintah | Fungsi | Akses |
|---|---|---|
| `!logs [n]` | Lihat N baris terakhir log systemd bot | Owner |

### 🚀 Peningkatan & Otomasi
- **Smart Morning Briefing 2.0** — Jadwal briefing diubah ke **09:00 WIB**. Kini menyertakan ringkasan berita teknologi terbaru (Arch Linux, Gadget) hasil pencarian real-time AI.
- **Google Tasks Synchronization** — Perintah `!remind` kini otomatis menyinkronkan pengingat ke akun Google Tasks Anda secara native.
- **Unified Error Handling** — Sistem penanganan error terpusat dengan kemampuan *self-healing* sederhana dan notifikasi kritis ke Owner.
- **Database Health Tool** — Script `src/utils/dbInit.js` untuk memvalidasi dan memperbaiki skema database Supabase secara otomatis.

---
*Last Updated — v5.1.0*
