# GEN-Z.AI

**Create Without Limits** — AI Creative Platform untuk generate video, image-to-video, digital human, dan AI vision dalam satu engine.

**Deployment:** Cloudflare Worker (`genzai`)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](LICENSE)
[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-orange)](https://workers.cloudflare.com/)

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **AI Video Generation** | Generate video dari prompt teks |
| **Image → Video** | Hidupkan gambar statis menjadi video dinamis |
| **Digital Human** | Talking avatar / lipsync dari gambar + audio |
| **AI Vision** | Analisis gambar untuk mendukung proses creative |
| **Live Chat AI** | Percakapan OpenKey, konteks URL publik, analisis video per detik, dan prompt final video/gambar yang dapat disalin terpisah |
| **Credit System** | Sistem kredit berbasis resolusi (480p / 720p / 1080p) + discount |
| **Studio Medsos** | Social Publisher dengan akses langganan, pengaturan harga, dan autopost Facebook Page |
| **NSFW Filter** | Server-side content moderation (SightEngine) |
| **Admin Panel** | Kelola user, model, kredit, dan provider credentials |

---

## Tech Stack

- **Frontend**: Static HTML / CSS / Vanilla JS
- **Backend**: Cloudflare Workers (Node.js compatibility)
- **Database & Auth**: Supabase (Auth, PostgreSQL, RPC)
- **Providers**:
  - KIE.AI (Grok Imagine, Seedance 2.5)
  - Motiongen-AI (Digital Human LipSync, Seedance, Wan)
- **Content Safety**: SightEngine
- **Deployment**: Cloudflare Workers, deployed through GitHub Actions

---

## Arsitektur Generate Flow

```
Frontend
   ↓
POST /api/generate
   ↓
Supabase Auth (Bearer Token)
   ↓
Model Registry (models/<model-folder>)
   ↓
Optional Admin Config (Supabase models table)
   ↓
Provider Credentials (encrypted)
   ↓
Provider API → taskId
   ↓
generation_history (status: processing)
   ↓
Credit deduction via RPC (deduct_generate_credits)
```

### Credit Calculation

```
credit_final = credit - (credit * discount_percent / 100)
```

Credit diambil dari kolom:
- `credit_480p`
- `credit_720p`
- `credit_1080p`

---

## Studio Medsos

Studio Medsos menyediakan Social Publisher untuk mengelola karakter, Facebook
Page, posting manual, dan jadwal autopost. Untuk posting manual, pilih karakter
tersimpan, Facebook Page tujuan, dan rasio **9:16** atau **16:9**. Gambar baru
dibuat dari foto referensi privat, metadata dibersihkan melalui Metadata Cleaner,
lalu hasil dan caption ditampilkan sebagai pratinjau. Post hanya diterbitkan
setelah tombol konfirmasi ditekan. Setiap posting manual tercatat di riwayat.
Caption dasar dan link HTTPS dapat disimpan sekali untuk digunakan pada semua
post; hashtag ditempatkan setelah link, bersama satu kalimat singkat yang dibuat
AI sesuai gambar. Jadwal autopost memakai rasio tersimpan dan menjalankan
generasi caption serta pembersihan metadata sebelum mengirim gambar ke Facebook.
Akses fitur diverifikasi di server berdasarkan
langganan user yang aktif dan masa berlakunya; mengubah tampilan browser tidak
dapat melewati pemeriksaan akses API.

Sebelum mengaktifkan fitur, jalankan skrip berikut di Supabase SQL Editor:

1. `supabase/studio-medsos-access.sql` untuk tabel akses berlangganan dan
   kebijakan akses.
2. `supabase/studio-medsos-pricing.sql` untuk pengaturan harga langganan.
   Skrip harga aman dijalankan ulang pada tabel yang sudah ada untuk
   menambahkan kolom harga per periode.
3. `supabase/social-auto-publisher.sql` untuk koneksi Facebook, jadwal,
   riwayat, pengaturan caption/link, dan rasio gambar. Jalankan ulang setelah
   memperbarui skema Social Publisher agar kolom/tabel tambahan tersedia.

Admin dan owner dapat membuka **Admin Panel → SET Studio Medsos** untuk
mengaktifkan langganan user, mengatur durasi dan waktu mulai, serta menetapkan
harga **per hari, per minggu, per bulan, dan per tahun**. Harga dikonfigurasi
secara manual dalam Rupiah; kolom harga yang dibiarkan kosong akan ditampilkan
sebagai “Belum ditentukan” di blok harga halaman Studio Medsos dan pengingat
akses langganan. Daftar user dengan langganan aktif juga tersedia pada halaman
pengaturan tersebut.

API Studio Medsos menggunakan `SUPABASE_URL`, `SUPABASE_ANON_KEY` (atau
`SUPABASE_KEY`), dan `SUPABASE_SERVICE_ROLE_KEY` dari environment server.
Social Publisher juga memerlukan `GEMINI_API_KEY` untuk membuat gambar dan
caption kontekstual, serta `SOCIAL_TOKEN_ENCRYPTION_KEY` untuk melindungi token
Facebook. Integrasi gambar menggunakan Nano Banana 2 Lite
(`gemini-3.1-flash-lite-image`), sedangkan caption menggunakan
`gemini-2.5-flash`. Admin dapat memilih Google Gemini atau Cloudflare Workers AI
sebagai provider gambar di **Admin Panel → SET Studio Medsos**. Pilihan
Cloudflare memakai binding `AI` dengan model SDXL-Lightning image-to-image;
caption kontekstual tetap memerlukan `GEMINI_API_KEY`. Kuota dan biaya
bergantung pada tier akun provider masing-masing. Service role key hanya
digunakan server dan tidak boleh dikirim ke browser.

---

## Model yang Tersedia

| Model ID | Nama | Type | Provider |
|----------|------|------|----------|
| `grok-imagine/image-to-video` | Grok Imagine Image to Video | image-to-video | KIE.AI |
| `bytedance/seedance-2-5` | Seedance 2.5 | text-to-video | KIE.AI |
| `digital-human-lipsync-image` | Digital Human - LipSync Image | image-to-video | Motiongen-AI |
| `seedance-25-studio-s14` | Seedance 2.5 (30s) | text-to-video | Motiongen-AI |
| `wan-30-ref-s6` | Wan 3.0 Reference Video (15s) | image-to-video | Motiongen-AI |

Jalankan `supabase/generation-failure-credit-refund.sql` di Supabase SQL
Editor agar kegagalan task mengembalikan kredit GEN-Z.AI secara idempoten
untuk semua model. Migration lama
`supabase/seedance-25-studio-failure-refund.sql` hanya mencakup Seedance
Motiongen dan kini digantikan migration tersebut. Untuk mengaktifkan Seedance
Motiongen, buat/aktifkan model `seedance-25-studio-s14` di Admin Models dengan
provider `motiongen` dan harga `6` pada ketiga tier kredit.
Untuk Wan 3.0 Reference Video, buat/aktifkan model `wan-30-ref-s6` dengan
provider `motiongen` dan harga `4` pada ketiga tier kredit. Model ini wajib
menerima 1–6 gambar referensi dan dapat memakai satu video referensi opsional.

Setiap model memiliki folder sendiri di `models/` dengan struktur:

```
models/<model-name>/
├── config.js              # Model identity & API endpoints
├── parameters.js          # Parameter schema
├── parameter-adapter.js   # Transform parameter ke format provider
├── create-task.js         # Buat task di provider
├── query-task.js          # Query status task
└── index.js               # Export adapter
```

---

## Project Structure

```
GEN-Z.AI/
├── api/                          # API handlers routed by the Cloudflare Worker
│   ├── generate.js               # POST /api/generate
│   ├── generate-status.js        # Query generation status
│   ├── model-config.js           # Model configuration
│   ├── admin-*.js                # Admin endpoints
│   ├── sightengine-detect.js     # NSFW detection
│   └── ...
├── models/                       # Model adapters
│   ├── grok-imagine-image-to-video/
│   ├── seedance-2-5/
│   └── digital-human-lipsync-image/
├── admin/ / admin-control/       # Admin dashboard
├── generate/                     # Generate page
├── history/                      # Generation history
├── user/                         # User profile & settings
├── topup/payment/                # Credit top-up
├── lib/                          # Shared utilities
├── index.html                    # Landing page
├── login.html / register.html    # Auth pages
└── ...
```

---

## Environment Variables

Buat file `.dev.vars` untuk pengembangan lokal. Untuk production, atur
variables dan secrets di Cloudflare Worker → Settings → Variables and Secrets.

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-project-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Provider credential encryption (32-byte key recommended)
PROVIDER_CREDENTIAL_ENCRYPTION_KEY=your-32-byte-secret-key

# Optional: SightEngine (NSFW checker)
# SIGHTENGINE_API_USER=...
# SIGHTENGINE_API_SECRET=...
```

> **Penting**: Jangan pernah commit `.env` atau service role key ke repository.
> `SUPABASE_ANON_KEY` harus berasal dari project yang sama dengan `SUPABASE_URL`.
> Jangan commit `.dev.vars`; `SUPABASE_SERVICE_ROLE_KEY` wajib disimpan sebagai
> secret dan tidak boleh dikirim ke browser atau repository.

---

## Setup & Deployment

### Prerequisites

- Node.js 18+
- Akun Cloudflare dengan izin deploy Workers
- Repository GitHub dengan GitHub Actions aktif
- Project Supabase
- API key dari provider (KIE.AI / Motiongen)

### Deploy ke Cloudflare Workers

1. Fork atau clone repository ini dan hubungkan repository ke workflow GitHub Actions.
2. Tambahkan repository secret `CLOUDFLARE_API_TOKEN` dengan izin deploy Worker
   pada akun yang ditetapkan di `wrangler.toml`.
3. Atur runtime variables dan secrets pada Cloudflare Worker `genzai` melalui
   **Settings → Variables and Secrets**. Tambahkan juga konfigurasi Preview jika
   menggunakan environment Preview.
4. Push ke branch `main`, atau jalankan workflow
   `.github/workflows/deploy-cloudflare-worker.yml` secara manual dari tab Actions.

Workflow membangun aset statis ke `dist/`, lalu menjalankan `wrangler deploy`
untuk menerbitkan Worker dan route API.

### Email Link Authentication

`SITE_URL` in `assets/js/config.js` uses the current site origin, including the
Cloudflare production domain. In Supabase Authentication URL Configuration,
set the production origin as the Site URL and add
`<production-site-origin>/login.html` as a Redirect URL so email sign-in and
signup links return to the deployed site.

### Live Support Chat

The floating support chat is loaded across the site's HTML pages. Run the latest
`supabase/support-chat.sql` in the Supabase SQL Editor (also when updating an
existing chat installation) and enable **Anonymous Sign-Ins** under
Authentication → Providers → Anonymous so visitors without an account can open
a support conversation. Authenticated administrators and owners can reply to
open conversations from the same floating chat inbox. Unread visitor messages
show a blinking green `BARU` badge in the admin inbox; new admin replies also
show a green notification on the visitor's chat icon, including while the chat
panel is closed. Each message stores and displays the sender's name in both the
admin and visitor chat views. The chat records read receipts in both directions
and the admin's profile name. The chat header shows whether an
admin is currently online. Sent messages show gray double checks until the
recipient reads them, then green double checks; closing the chat without
opening a conversation leaves it unread. If no admin reads a visitor's latest
message within five minutes, a one-time busy notice is added to that
conversation without closing it. Chat participants may attach JPEG, PNG, or
WebP images; images are resized and stored in the message row in the database,
not in Supabase Storage. Row-level security restricts conversations and
messages to their owner and support staff.

### Tarif Credit Fitur

Run `supabase/feature-credit-settings.sql` in the Supabase SQL Editor before
using the feature-credit settings page. Re-run this migration on existing
installations to add the separate video-upscale rate. The migration initializes
Vision, Vision Video, photo Upscale, video Upscale, Prompt Studio, and Metadata
Cleaner at one credit each.
Admin and owner accounts can change these rates from Admin Control → Tarif
Credit Fitur; a rate of zero makes a feature free. The server reads the saved
rate when charging, so the displayed value is informational rather than a
client-side billing authority. Charges happen on Vision generation, Vision
Video analysis, photo/video Upscale processing, Prompt Studio copy, and both Metadata
Cleaner CHECK and CLEAN actions. Failed operations refund their charge.

### Upscale Video

Video sumber hingga 100 MB dikompres di browser sebelum diunggah ke Supabase
Storage yang memiliki batas 50 MB. Kompresi menggunakan MediaRecorder pada
perangkat pengguna; browser yang tidak mendukung kompresi lokal akan
menampilkan pesan error dan meminta pengguna mencoba Chrome versi terbaru.
Jalankan `supabase/upscale-video-upload-policy.sql` di Supabase SQL Editor agar
akun yang login dapat mengunggah video sementara hanya ke folder Upscale milik
akunnya sendiri di bucket `dashboard-videos`.

### Informasi Penting untuk Akun

Jalankan `supabase/site-announcements.sql` di Supabase SQL Editor sebelum
menggunakan Admin Control → Informasi Penting; jalankan kembali skrip ini untuk
menambahkan kolom media dan link CHECK bila tabel telah dibuat sebelumnya.
Admin dan owner dapat menyimpan
draft atau menerbitkan satu informasi aktif untuk semua akun user dan admin,
memilih kategori, mengunggah foto/video, menambahkan link tombol CHECK, dan
menetapkan waktu kedaluwarsa opsional. Bucket publik `site-announcements`
dibuat otomatis pada unggahan media pertama; format foto dibatasi 10 MB dan
video 50 MB. Informasi yang diterbitkan muncul sebagai dialog di halaman akun;
tombol CHECK membuka tautan admin, sedangkan tombol OK menyembunyikan versi
pengumuman tersebut pada akun di perangkat itu. Pengumuman yang diterbitkan
tampil langsung pada halaman admin yang menerbitkan dan diperiksa setiap 5
detik pada halaman akun lain yang sedang terbuka.
Jika user sedang logout saat informasi diterbitkan, informasi aktif akan muncul
otomatis segera setelah ia login dan navigasi akun siap, selama belum
kedaluwarsa atau dikonfirmasi pada perangkat tersebut.

### Konfigurasi Cloudflare Workers

Repository ini menyediakan konfigurasi Cloudflare Worker yang menayangkan aset
frontend dari `dist/` dan merutekan endpoint API melalui Worker. Cloudflare
Worker `genzai` adalah target deployment production.

1. Tambahkan GitHub Actions repository secret `CLOUDFLARE_API_TOKEN` dengan
   token yang memiliki izin deploy Workers pada akun Cloudflare yang ditetapkan
   di `wrangler.toml`. Jangan masukkan token ke file repository.
2. Setiap push ke branch `main` akan menjalankan
   `.github/workflows/deploy-cloudflare-worker.yml`: workflow membangun aset
   dengan `node scripts/build-cloudflare-pages.mjs` lalu deploy menggunakan
   `npx wrangler@4 deploy`. Workflow juga dapat dijalankan manual dari tab
   Actions. Jangan gunakan `wrangler pages deploy` untuk Worker ini.
3. Untuk indikator online lintas perangkat pada dashboard admin, jalankan
   `supabase/user-presence.sql` di Supabase SQL Editor. Sesi mengirim heartbeat
   setiap 20 detik; akun dianggap offline setelah 90 detik tanpa heartbeat.
   Untuk auto-refund job Motiongen Seedance yang gagal, jalankan juga
   `supabase/seedance-25-studio-failure-refund.sql` sebelum mengaktifkan model.
4. Tambahkan environment variables dan secrets pada pengaturan Worker,
   termasuk Preview jika digunakan:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (atau
   `SUPABASE_KEY`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, `KIE_API_KEY`,
   `KIE_API_ENDPOINT` / `KIE_API_BASE_URL`, `OPENKEY_API_KEY`,
   `OPENKEY_API_ENDPOINT` / `OPENKEY_API_BASE_URL`, `VIDDRA_API_KEY`,
   `VIDDRA_SESSION_SECRET`, `SIGHTENGINE_API_USER`,
   `SIGHTENGINE_API_SECRET`, `GITHUB_PAT`, `GITHUB_OWNER`, `GITHUB_REPO`,
   `GITHUB_WORKFLOW_FILE`, and `GITHUB_REF`.
   For photo/video upscale, set `GITHUB_PAT` as a Worker secret with
   permission to dispatch repository Actions workflows (`Actions: write` for a
   fine-grained token). The upscale handler reads Worker bindings at request
   time; `GITHUB_OWNER` and `GITHUB_REPO` default to `sugionoofficial` and
   `GEN-Z.AI`, so they only need to be overridden for another repository.
5. Setelah deployment, uji login, generate/status, admin, Viddra, OpenKey
   streaming, serta integrasi provider pada domain production.

`wrangler.toml` menetapkan entry point Worker, kompatibilitas runtime Node, serta
aset statis. Jangan commit secret atau menyalin `.env.local` ke output; masukkan
nilai secret langsung melalui pengaturan Cloudflare. Push ke `main` memicu
GitHub Actions untuk build dan deploy Worker.

### Pengembangan Lokal

```bash
# Clone
git clone https://github.com/sugionoofficial/GEN-Z.AI.git
cd GEN-Z.AI

# Buat .dev.vars berisi konfigurasi Supabase dan provider untuk development.
# Jangan commit file ini; gunakan nilai development, bukan production secrets.

# Build aset statis dan jalankan Worker lokal
node scripts/build-cloudflare-pages.mjs
npx wrangler@4 dev
```

Live Chat AI mengambil maksimal 30 cuplikan video (satu per detik) untuk analisis
gerakan, lingkungan yang terlihat, sudut kamera, dan pencahayaan. Video di atas
30 detik harus dipotong terlebih dahulu. Saat membuat prompt, pilih keluaran
video/gambar dan, bila perlu, aktifkan opsi ganti karakter agar detail adegan
lainnya tetap dipertahankan.

---

## API Endpoints Utama

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/generate` | Mulai generation (butuh auth) |
| `GET/POST` | `/api/generate-status` | Cek status generation |
| `GET` | `/api/model-config` | Ambil konfigurasi model |
| `POST` | `/api/sightengine-detect` | NSFW detection |
| Admin | `/api/admin-*` | User, model, credit, provider management |

### Contoh Request Generate

```http
POST /api/generate
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "model_id": "grok-imagine/image-to-video",
  "parameters": {
    "prompt": "A cinematic shot of a futuristic city",
    "resolution": "720p",
    "image_url": "https://..."
  }
}
```

---

## Credit System

- Kredit dikurangi **sebelum** task dikirim ke provider (via RPC `deduct_generate_credits`)
- Jika generation gagal, kredit bisa di-refund via `refund_generate_credits`
- History generation **tidak** melakukan deduction/refund (hanya mencatat status)
- Admin dapat mengatur `credit_480p`, `credit_720p`, `credit_1080p`, dan `discount_percent` per model

---

## Security Notes

- Semua credential provider disimpan terenkripsi di database
- Response dari provider di-sanitize (API key, token, secret di-redact)
- NSFW checker dipaksa di server-side (tidak bisa di-bypass dari client)
- Auth menggunakan Supabase JWT (Bearer token)
- Service Role Key hanya digunakan di server (serverless functions)

---

## Menambah Model Baru

1. Buat folder baru di `models/<nama-model>/`
2. Implementasikan file wajib:
   - `config.js`
   - `parameters.js`
   - `create-task.js`
   - `query-task.js`
   - `index.js`
3. Daftarkan adapter di `MODEL_REGISTRY` pada `api/generate.js`
4. Tambahkan konfigurasi credit di Supabase table `models`
5. Deploy ulang

---

## License

Distributed under the **GNU General Public License v3.0**.  
Lihat file [LICENSE](LICENSE) untuk detail.

---

## Author

**sugionoofficial**  
[GitHub](https://github.com/sugionoofficial)

---

> Built for creators who want to turn ideas into visual experiences — without the complexity.
```