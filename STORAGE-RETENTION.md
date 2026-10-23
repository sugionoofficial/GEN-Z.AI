# GEN-Z.AI — Retensi Media (Supabase Storage)

Dokumen ini menjelaskan **di mana file media disimpan**, **berapa lama**, dan
**siapa yang menghapusnya**. Aturan ini dijalankan otomatis oleh cron
Cloudflare Worker; tidak ada langkah manual yang dibutuhkan setelah deploy.

## Ringkasan aturan

| Media | Lokasi | Umur | Setelah kedaluwarsa |
|---|---|---|---|
| Foto / video / audio yang diunggah di halaman **Generate** | `user-uploads/generate-input/<user-id>/…` (**privat**) | **1 jam** | File dihapus dari Storage |
| Input **Upscale** (foto & video) | `user-uploads/upscale-photos/inputs/…`, `user-uploads/upscale-videos/inputs/…` (**privat**) | **24 jam** | File dihapus |
| Output **Upscale** | `dashboard-videos/upscale-photos/outputs/…`, `dashboard-upscales/outputs/…` (publik) | **24 jam** | File dihapus, baris History ditandai **KEDALUWARSA** |
| Konten situs (video & thumbnail dashboard yang diunggah admin) | `dashboard-videos/videos/…`, `dashboard-videos/thumbnails/…` | permanen | **Tidak pernah disentuh cron** |
| Referensi / outfit Studio Medsos | `social-character-references/…` (privat) | permanen | Tidak disentuh cron |
| Pengumuman & bukti topup | `site-announcements/…`, `topup-proofs/…`, `topup-payment-assets/…` | permanen | Tidak disentuh cron |

> Hasil generate video dari provider **tidak** disimpan di Supabase Storage:
> yang disimpan hanya URL milik provider. Retensi file di sisi provider
> sepenuhnya diatur provider tersebut.

## Bucket privat & signed URL

1. Semua **upload user** sekarang masuk ke bucket **privat**
   `user-uploads` (`supabase/user-media-bucket.sql`). Tidak ada public URL
   untuk file ini.
2. Setelah upload, aplikasi meminta **signed URL berdurasi 1 jam**
   (`createSignedUrl`) dan URL itulah yang dikirim ke provider AI /
   GitHub Actions.
3. API upscale memvalidasi signed URL tersebut
   (`lib/generate/upscale-source.js`): origin harus Supabase, path harus
   `upscale-videos/inputs/<user-id>/…` milik akun yang login, dan hanya
   parameter `token` yang diizinkan. Path publik lama tetap diterima untuk
   job yang belum selesai.
4. Bucket `dashboard-videos` tetap **publik** karena masih menyimpan konten
   situs (`videos/`, `thumbnails/`) dan output upscale.

## Implementasi

- Aturan TTL & pembersihan: `lib/storage-retention/cleanup.js`
  - `UPLOAD_TTL_MS` = 1 jam
  - `HISTORY_MEDIA_TTL_MS` = 24 jam
  - `RETENTION_RULES` = daftar bucket + prefix + TTL yang **boleh** dibersihkan
    (bucket `user-uploads` untuk upload baru, plus `dashboard-videos` dan
    `dashboard-upscales` untuk sisa file lama)
- Pembungkus cron: `functions/_shared/storage-retention-cron.js`
- Penjadwalan: `functions/worker.mjs` → `scheduled()` menjalankan
  `runSocialPublisherCron` **dan** `runStorageRetentionCron` lewat
  `Promise.allSettled`, sehingga satu cron gagal tidak memblok yang lain.
- Frekuensi: cron Cloudflare berjalan tiap menit, tetapi pembersihan storage
  hanya dieksekusi tiap **5 menit** (`shouldRunStorageCleanup`).

## Keamanan

1. Hanya prefix yang terdaftar di `RETENTION_RULES` yang boleh dihapus.
   Prefix `videos/` dan `thumbnails/` (konten situs) sengaja tidak terdaftar.
2. Semua path divalidasi dengan `isPathInsidePrefix()`:
   path dengan `..`, NUL, atau di luar prefix akan **ditolak** dan dilewati.
3. Kredensial hanya dibaca dari env Worker (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`); tidak ada key yang ditulis di repo.
4. Penghapusan dilakukan per 100 objek agar payload Storage API tetap kecil.

## Cara memeriksa / mengeringkan (dry run)

Ringkasan hasil cron dicatat di log Worker hanya bila ada file terhapus/gagal:

```
[Storage Retention] 312 file dihapus, 0 gagal, 400 file dipindai (1234 ms).
```

Untuk uji tanpa menghapus, jalankan dari Node:

```js
import { createStorageApi, runStorageCleanup, RETENTION_RULES } from "./lib/storage-retention/cleanup.js";

const api = createStorageApi({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
});

const summary = await runStorageCleanup(api, { dryRun: true });
console.table(summary.rules);
```

## Tampilan ke user

| Halaman | Teks |
|---|---|
| `generate/index.html` | "Foto, video, dan audio yang kamu unggah hanya bisa dipakai **1 jam**…" (`#generateStorageNote`) |
| `history/index.html` | Banner "Media hasil generate & upscale disimpan **maksimal 24 jam**…" (`#historyRetentionNotice`) + thumbnail **KEDALUWARSA** |
| `upscale/index.html` | Catatan "File input & hasil upscale disimpan **maksimal 24 jam**…" |

## Konsekuensi yang perlu diketahui

1. Item History yang lebih dari 24 jam tetap tampil sebagai catatan, tetapi
   thumbnail, tombol download, dan tombol upscale dinonaktifkan.
2. Tombol **Regenerate** untuk item lama akan meminta unggah ulang referensi,
   karena file input sudah dihapus setelah 1 jam.
3. Upload user **tidak lagi publik**: file hanya bisa diakses lewat signed
   URL 1 jam atau oleh pemilik akun. Output upscale masih publik, tetapi
   tetap dihapus setelah 24 jam.
