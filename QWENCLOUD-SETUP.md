# QwenCloud (Alibaba Cloud Model Studio / DashScope) — Setup

Provider **`qwencloud`** menghubungkan GEN-Z.AI ke seluruh model video Wan
di QwenCloud: text-to-video, image-to-video, first/last frame,
reference-to-video, dan Wan Animate.

Semua model video yang tersedia di akun QwenCloud (gratis 50 detik per
model) sudah terdaftar — total **13 model**.

---

## 1. File yang Terlibat

```
provider/qwencloud/client.js        HTTP client DashScope (create + polling)
models/qwencloud-video/specs.js     daftar 13 model (edit di sini untuk menambah)
models/qwencloud-video/factory.js   adapter generator (config, validate, payload)
models/qwencloud-video/index.js     registry model
supabase/qwencloud-provider-models.sql   seed provider + model + credit
tests/qwencloud-video.test.mjs      19 test adapter & client
```

Adapter QwenCloud otomatis terdaftar di:

- `api/generate.js` — buat task (POST `/api/generate`)
- `api/generate-status.js` — polling status
- `api/model-config.js` — konfigurasi model untuk halaman Generate
- `admin-control/models/models-data.js` — daftar model di Admin Panel

---

## 2. Ambil API Key

1. Login ke **QwenCloud / Alibaba Cloud Model Studio**.
2. Buka **API Keys** → **Create API key**.
3. Salin key (`sk-...`). **Key per region** — key Singapore hanya berlaku
   untuk endpoint Singapore.

---

## 3. Daftarkan Provider di GEN-Z.AI

### a. Jalankan SQL seed

Supabase → SQL Editor → jalankan:

```
supabase/qwencloud-provider-models.sql
```

File ini membuat:

- baris `providers` dengan `provider_id = 'qwencloud'`
- 13 baris `models` (status `active`, credit default)

### b. Isi API key

Admin Panel → **Providers** → **QwenCloud** → **API Key** → simpan.
Key disimpan terenkripsi (AES-256-GCM) di tabel `provider_credentials`
dan **tidak pernah** dikirim ke browser.

### c. Sesuaikan credit

Admin Panel → **Models** → pilih model QwenCloud → atur
`credit_480p` / `credit_720p` / `credit_1080p` / diskon.

Harga acuan QwenCloud (Singapore):

| Model | 720P | 1080P |
|---|---|---|
| `wan2.6-t2v` | $0.10 / detik | $0.15 / detik |
| `wan2.6-i2v` | $0.10 / detik | $0.15 / detik |

Model dengan harga flat (tanpa resolusi), seperti Wan Animate, memakai
`credit_720p` sebagai harga tunggal.

---

## 4. Environment (opsional)

Default endpoint: `https://dashscope-intl.aliyuncs.com/api/v1`

Kalau dashboard QwenCloud menampilkan URL workspace sendiri, set:

```env
DASHSCOPE_BASE_URL=https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1
```

Tidak ada perubahan kode yang dibutuhkan.

---

## 5. Endpoint yang Dipakai

| Jenis | Endpoint | Input utama |
|---|---|---|
| t2v / i2v / r2v | `/services/aigc/video-generation/video-synthesis` | `prompt`, `img_url`, `reference_urls` |
| kf2v / animate | `/services/aigc/image2video/video-synthesis` | `first_frame_url`, `last_frame_url`, `image_url`, `video_url` |
| polling | `/tasks/{task_id}` | — |

Semua request create memakai header wajib:

```
X-DashScope-Async: enable
```

---

## 6. Pemetaan Parameter di Halaman Generate

| Parameter | Tipe field | Muncul pada |
|---|---|---|
| `image_urls` | koleksi gambar | r2v |
| `image_url` | gambar tunggal | i2v, animate |
| `first_frame_url` + `last_frame_url` | dua blok gambar | kf2v |
| `video_urls` | koleksi video | r2v |
| `video_url` | video tunggal | animate |
| `audio_url` | audio | t2v / i2v (2.5 & 2.6) |
| `prompt` | textarea | semua |
| `negative_prompt` | textarea | t2v / i2v / kf2v |
| `aspect_ratio` | enum | t2v / r2v |
| `resolution` | enum | t2v / i2v / r2v / kf2v |
| `duration` | enum | t2v / i2v / r2v / kf2v |
| `mode` | enum (`wan-std`, `wan-pro`) | animate |
| `prompt_extend` | boolean | t2v / i2v / kf2v / r2v |

Urutan blok di halaman Generate otomatis mengikuti aturan global:

```
Gambar Referensi → Video Referensi → Audio Referensi → Prompt → lainnya
```

Parameter yang tidak ada pada model tidak dirender sama sekali, jadi model
t2v hanya menampilkan Prompt, sedangkan kf2v menampilkan dua blok gambar.

---

## 7. Menambah Model Baru

Cukup tambah satu objek di `models/qwencloud-video/specs.js`:

```js
{
    id: "qwen-wan2.7-t2v",
    dashscopeModel: "wan2.7-t2v",
    name: "Wan 2.7 Text to Video",
    kind: "t2v",                 // t2v | i2v | kf2v | r2v | animate
    type: "text-to-video",
    ratios: ["16:9", "9:16", "1:1"],
    resolutions: ["720P", "1080P"],
    durations: ["5", "10", "15"],
    defaultDuration: "5",
    negativePrompt: true,
    audioTrack: true,
    shotType: true,
    maxPrompt: 2000
}
```

Lalu tambahkan baris `models` di Supabase (atau lewat Admin Panel).
Tidak perlu file adapter baru.

---

## 8. Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| `INVALID_API_KEY` | Key beda region dengan `DASHSCOPE_BASE_URL` |
| `FREE_QUOTA_EXHAUSTED` | Kuota gratis 50 detik habis, toggle *Free quota only* menyala |
| `current user api does not support synchronous calls` | Header `X-DashScope-Async` hilang (tidak terjadi di adapter ini) |
| `INVALID_PAYLOAD` | Nilai `resolution` / `duration` di luar dukungan model |
| Video hilang setelah 24 jam | `video_url` DashScope hanya valid 24 jam — unduh cepat |
| `PROVIDER_TIMEOUT` | Create 60 detik / polling 30 detik terlampaui |

Log provider tidak pernah memuat API key — semua secret di-redact sebelum
masuk Cloudflare Workers Logs.
