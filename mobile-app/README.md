# GEN-Z.AI Mobile

Starter aplikasi Android/iOS menggunakan Capacitor WebView. Aplikasi membuka
situs GEN-Z.AI yang dilayani Cloudflare Workers:
`https://genzai.genzai-f37.workers.dev`.

Konten situs dan backend akan mengikuti pembaruan online saat aplikasi dibuka
kembali. Perubahan identitas aplikasi, izin perangkat, plugin, atau kode native
tetap memerlukan build dan rilis aplikasi baru.

## Persyaratan

- Node.js 20.19+ atau 22.12+
- Android Studio + Android SDK untuk build Android
- macOS + Xcode untuk build iOS

## Siapkan proyek native

Dari folder `mobile-app`:

```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

`npx cap add ios` dan proses build iOS perlu dijalankan pada macOS dengan Xcode.

## Jalankan

```bash
npm run android
npm run ios
```

Perintah tersebut membuka proyek native di Android Studio atau Xcode. Pilih
emulator/perangkat lalu jalankan aplikasinya dari IDE.

## Sebelum distribusi

- Uji login, unggah file, pembayaran, unduhan, navigasi kembali, dan tautan
  eksternal di perangkat sungguhan.
- Siapkan ikon, splash screen, signing key, dan metadata store.
- Aplikasi memerlukan koneksi internet. Karena WebView diarahkan langsung ke
  situs online, halaman tidak tersedia jika situs atau koneksi internet sedang
  tidak dapat dijangkau. `www/index.html` hanya dipakai saat sinkronisasi
  aset Capacitor dan bukan fallback offline untuk konfigurasi ini.
  - Aplikasi native menyembunyikan status bar dan navigation bar sistem secara
    immersive. Bar sistem dapat muncul sementara melalui gesture sistem.
    Saat halaman berada paling atas, tarik layar ke bawah untuk memuat ulang.
  - Situs menyediakan PWA mode standalone. Pasang GEN-Z.AI dari browser untuk
    membuka semua halaman tanpa address bar dan toolbar browser. Browser biasa
    tidak mengizinkan situs menyembunyikan toolbar secara paksa.
  - Google Play dan App Store meninjau aplikasi pembungkus situs berdasarkan
  kebijakan masing-masing; integrasi mobile yang berguna dapat diperlukan.
