# 📹 Katalog Lokasi CCTV Indonesia

Dokumen ini berisi daftar portal resmi CCTV ATCS (Area Traffic Control System) di Indonesia yang bisa dijadikan sumber data untuk fitur `!cctv`.

## 🏙️ Portal Resmi (Live View)

| Kota/Wilayah | Link Portal | Keterangan |
| :--- | :--- | :--- |
| **Jakarta** | [smartcity.jakarta.go.id](https://smartcity.jakarta.go.id/maps/) | Pilih layer "CCTV Online" |
| **Bandung** | [atcs-dishub.bandung.go.id](http://atcs-dishub.bandung.go.id/) | Sangat stabil & lengkap |
| **Surabaya** | [cctv.surabaya.go.id](https://cctv.surabaya.go.id/) | Memerlukan login/scrapping |
| **Cianjur** | [atcs.cianjurkab.go.id](https://atcs.cianjurkab.go.id/) | Portal resmi Cianjur |
| **Malang** | [cctv.malangkota.go.id](http://cctv.malangkota.go.id/) | Area kota Malang |
| **Yogyakarta** | [atcs-diy.jogjaprov.go.id](https://dishub.jogjaprov.go.id/atcs-diy) | Area DIY |
| **Semarang** | [cctv.semarangkota.go.id](https://cctv.semarangkota.go.id/) | Area kota Semarang |
| **Jalan Tol** | [bpjt.pu.go.id/cctv](https://bpjt.pu.go.id/cctv/cctv_inframe) | Seluruh Tol Indonesia |

## 🛠️ Cara Menambahkan Lokasi Baru
Jika Anda menemukan link streaming langsung (akhiran `.m3u8`), tambahkan ke file:
`src/data/cctv.json`

**Format JSON:**
```json
{
    "kota": "Nama Kota",
    "lokasi": "Nama Jalan/Simpang",
    "url": "http://link-streaming-anda.m3u8"
}
```

## 📝 Catatan Penting
- **Link Dinamis**: Link `.m3u8` seringkali berubah (tokenized). Jika bot gagal mengambil gambar, kemungkinan link tersebut sudah kedaluwarsa.
- **Privacy**: Gunakan hanya CCTV publik resmi untuk memantau lalu lintas/cuaca.
- **Cianjur**: Untuk Cianjur, saat ini link stream-nya terproteksi di balik portal. Saya bisa membantu membuatkan *scraper* khusus jika Anda sering membutuhkan pantauan di sana.
