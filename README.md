# GEN-Z.AI

**Create Without Limits** — AI Creative Platform untuk generate video, image-to-video, digital human, dan AI vision dalam satu engine.

**Live Demo:** [https://genzai-steel.vercel.app](https://genzai-steel.vercel.app)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://genzai-steel.vercel.app)

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **AI Video Generation** | Generate video dari prompt teks |
| **Image → Video** | Hidupkan gambar statis menjadi video dinamis |
| **Digital Human** | Talking avatar / lipsync dari gambar + audio |
| **AI Vision** | Analisis gambar untuk mendukung proses creative |
| **Credit System** | Sistem kredit berbasis resolusi (480p / 720p / 1080p) + discount |
| **NSFW Filter** | Server-side content moderation (SightEngine) |
| **Admin Panel** | Kelola user, model, kredit, dan provider credentials |

---

## Tech Stack

- **Frontend**: Static HTML / CSS / Vanilla JS
- **Backend**: Vercel Serverless Functions (Node.js), with Cloudflare Workers migration scaffold
- **Database & Auth**: Supabase (Auth, PostgreSQL, RPC)
- **Providers**:
  - KIE.AI (Grok Imagine, Seedance 2.5)
  - Motiongen-AI (Digital Human LipSync)
- **Content Safety**: SightEngine
- **Deployment**: Vercel

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

## Model yang Tersedia

| Model ID | Nama | Type | Provider |
|----------|------|------|----------|
| `grok-imagine/image-to-video` | Grok Imagine Image to Video | image-to-video | KIE.AI |
| `bytedance/seedance-2-5` | Seedance 2.5 | text-to-video | KIE.AI |
| `digital-human-lipsync-image` | Digital Human - LipSync Image | image-to-video | Motiongen-AI |

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
├── api/                          # Vercel Serverless Functions
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

Buat file `.env` (atau set di Vercel Project Settings):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Provider credential encryption (32-byte key recommended)
PROVIDER_CREDENTIAL_ENCRYPTION_KEY=your-32-byte-secret-key

# Optional: SightEngine (NSFW checker)
# SIGHTENGINE_API_USER=...
# SIGHTENGINE_API_SECRET=...
```

> **Penting**: Jangan pernah commit `.env` atau service role key ke repository.

---

## Setup & Deployment

### Prerequisites

- Node.js 18+
- Akun Vercel
- Project Supabase
- API key dari provider (KIE.AI / Motiongen)

### Deploy ke Vercel

1. Fork / clone repository ini
2. Import project ke [Vercel](https://vercel.com)
3. Set environment variables di Project Settings → Environment Variables
4. Deploy

Vercel akan otomatis mendeteksi folder `api/` sebagai serverless functions.

### Cloudflare Workers (migrasi bertahap)

Repository ini menyediakan konfigurasi Cloudflare Worker yang menayangkan aset
frontend dari `dist/` dan membungkus endpoint API yang sebelumnya menggunakan
format handler Vercel. Pertahankan deployment Vercel sampai semua endpoint dan
provider sudah diuji di Cloudflare.

1. Hubungkan repository GitHub ke Worker `gen-zai` melalui Git integration /
   Workers Builds.
2. Gunakan build command `node scripts/build-cloudflare-pages.mjs`, lalu deploy
   dengan `npx wrangler deploy`. Wrangler membaca `main` dan konfigurasi aset
   dari `wrangler.toml`; jangan gunakan `wrangler pages deploy` untuk Worker ini.
3. Tambahkan environment variables dan secrets pada pengaturan Worker,
   termasuk Preview jika digunakan:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (atau
   `SUPABASE_KEY`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, `KIE_API_KEY`,
   `KIE_API_ENDPOINT` / `KIE_API_BASE_URL`, `OPENKEY_API_KEY`,
   `OPENKEY_API_ENDPOINT` / `OPENKEY_API_BASE_URL`, `VIDDRA_API_KEY`,
   `VIDDRA_SESSION_SECRET`, `SIGHTENGINE_API_USER`,
   `SIGHTENGINE_API_SECRET`, `GITHUB_PAT`, `GITHUB_OWNER`, `GITHUB_REPO`,
   `GITHUB_WORKFLOW_FILE`, and `GITHUB_REF`.
4. Uji login, generate/status, admin, Viddra, OpenKey streaming, serta integrasi
   provider pada URL preview sebelum mengalihkan domain production.

`wrangler.toml` menetapkan entry point Worker, kompatibilitas runtime Node, serta
aset statis. Jangan commit secret atau menyalin `.env.local` ke output; masukkan
nilai secret langsung melalui pengaturan Cloudflare. Perubahan yang di-push ke
branch terhubung akan memicu build otomatis melalui Git integration.

### Local Development

```bash
# Clone
git clone https://github.com/sugionoofficial/GEN-Z.AI.git
cd GEN-Z.AI

# Install Vercel CLI (jika belum)
npm i -g vercel

# Link project & pull env
vercel link
vercel env pull .env.local

# Run local
vercel dev
```

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