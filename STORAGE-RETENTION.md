# GEN-Z.AI — Retensi Media (Supabase Storage)

Dokumen ini menjelaskan **di mana file media disimpan**, **berapa lama**, dan
**siapa yang menghapusnya**. Aturan ini dijalankan otomatis oleh cron
Cloudflare Worker; tidak ada langkah manual yang dibutuhkan setelah deploy.

## Ringkasan aturan

| Media | Lokasi | Umur | Setelah kedaluwarsa |
|---|---|---|---|
| Foto / video / audio yang diunggah di halaman **Generate** | `user-uploads/generate-input/<user-id>/…` (**privat**) | **1 jam** | File dihapus dari Storage |
| Input **Upscale** (foto & video) | `user-uploads/upscale-photos/inputs/…`, `user-uploads/upscale-videos/inputs/…` (**privat**) | **24 jam** | File dihapus |
| Output **Upscale** | `user-uploads/upscale-photos/outputs/<user-id>/…`, `user-uploads/upscale-videos/outputs/<user-id>/…` (**privat**) — sisa file lama masih di `dashboard-videos/upscale-photos/outputs/…` dan `dashboard-upscales/outputs/…` (publik) | **24 jam** | File dihapus, baris History ditandai **KEDALUWARSA** |
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
   file milik akun yang login (`upscale-videos/inputs/<user-id>/…` untuk
   video, `upscale-photos/inputs/<user-id>/…` untuk foto), dan hanya
   parameter `token` yang diizinkan. Validasi jalan **sebelum** kredit
   dipotong. Path publik lama tetap diterima untuk job yang belum selesai.
4. Bucket `dashboard-videos` tetap **publik** karena masih menyimpan konten
   situs (`videos/`, `thumbnails/`). Output upscale **baru** tidak lagi
   ditulis ke sana.

## Output upscale privat (`supabase-private://`)

1. Workflow `upscale-photo.yml` dan `upscale.yml` mengunggah hasil ke bucket
   privat `user-uploads` di folder **user pemilik**
   (`upscale-photos/outputs/<user-id>/…`, `upscale-videos/outputs/<user-id>/…`).
2. `generation_history.result_url` **tidak** menyimpan URL publik dan juga
   bukan signed URL (signed URL kedaluwarsa 1 jam padahal file hidup 24 jam).
   Yang disimpan adalah referensi stabil:

   ```
   supabase-private://user-uploads/upscale-photos/outputs/<user-id>/<file>.jpg
   ```

3. Referensi itu ditukar menjadi **signed URL 30 menit** saat dibaca:
   - `api/generate.js` dan `api/generate-status.js` melakukannya otomatis di
     `json()` (`lib/generate/private-media.js`), dengan cache 10 menit supaya
     polling status tidak menandatangani ulang terus-menerus;
   - halaman riwayat menukarnya lewat Supabase client
     (`history/assets/js/history-data.js`), memakai RLS: user hanya bisa
     menandatangani file miliknya, ADMIN/OWNER boleh semua
     (`public.is_media_admin()`).
4. Kalau penandatanganan gagal (file sudah dihapus cron / bukan haknya),
   referensi dibiarkan / dikosongkan — tidak ada URL publik yang dipakai
   sebagai fallback.
5. Konsekuensi: link hasil upscale **tidak bisa dibagikan** ke orang lain —
   penerima link tidak punya sesi login pemilik file, dan token kedaluwarsa
   ±30 menit.
6. Baris lama dengan URL publik `dashboard-videos` / `dashboard-upscales`
   tetap berfungsi sampai terhapus cron 24 jam.
7. Referensi input (`generation_history.image_reference_url` /
   `video_reference_url`) juga disimpan sebagai `supabase-private://…`
   (`toPrivateMediaRef()`), bukan signed URL. Efeknya: thumbnail referensi di
   riwayat dan tombol **Regenerate** tetap berfungsi selama file masih ada
   (1 jam untuk input Generate, 24 jam untuk input Upscale), bukan hanya
   1 jam sejak upload.
8. Kalau referensi itu ikut terkirim balik ke API (mis. tombol Regenerate),
   `signUserMediaRefsInPayload()` menukarnya menjadi signed URL sebelum
   dipakai provider — **hanya** referensi di folder user yang login
   (`isRefOwnedByUser()`), supaya user tidak bisa menyuruh server
   menandatangani file user lain.

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
