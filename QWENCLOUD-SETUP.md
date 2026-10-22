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

#### Credit dihitung per blok 5 detik

QwenCloud menagih **per detik**, jadi credit di database adalah harga
untuk **5 detik (1 blok)** dan sistem mengalikannya otomatis:

| Durasi | Faktor | Contoh (`credit_720p = 30`) |
|---|---|---|
| 5 detik | 1x | 30 credit |
| 10 detik | 2x | 60 credit |
| 15 detik | 3x | 90 credit |

- Pembulatan ke atas: 6 detik → 2 blok.
- Model tanpa parameter durasi (Wan Animate) selalu 1x.
- Faktor dibatasi maksimal 10x sebagai pengaman.
- Diskon model tetap dihitung setelah faktor durasi.
- Logika ada di `lib/generate/qwencloud-credit.js` (murni fungsi, ada
  unit test di `tests/qwencloud-credit.test.mjs`), diuji juga lewat
  helper di `tests/`.

Contoh log saat generate:

```
credit_unit: 30, duration_seconds: 10, duration_factor: 2,
credit_base: 60, discount_percent: 0, credit: 60
```

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

## 8. Kuota Gratis QwenCloud

Aturan resmi QwenCloud yang memengaruhi provider ini:

| Aturan | Konsekuensi di GEN-Z.AI |
|---|---|
| Kuota gratis **hanya region Singapore** (API key + endpoint Singapore) | `DASHSCOPE_BASE_URL` lain (Beijing/Frankfurt) akan ditagih penuh dari detik pertama |
| Berlaku **90 hari** sejak aktivasi akun atau rilis model | Kuota tidak dipause walau tidak dipakai; sisa kuota hangus saat kedaluwarsa |
| **Per model**, tidak bisa digabung / dipindah | 13 model = 13 kuota terpisah, tidak otomatis dialihkan kalau satu habis |
| Snapshot bertanggal (mis. `wan2.6-t2v-2026-09-01`) dihitung **model terpisah** | Bisa didaftarkan sebagai model tambahan untuk mendapat kuota ekstra |
| Toggle **Free quota only** memblokir request saat kuota habis | Request gagal dengan `AllocationQuota.FreeTierOnly` → GEN-Z.AI menampilkan pesan kuota habis, credit user **otomatis direfund** |
| Tagihan tertunggak memblokir **semua** model walau kuota masih ada | Error `Arrearage` → pesan "Saldo QwenCloud tidak mencukupi" |

Cek sisa kuota di **Free Tier** (`home.qwencloud.com/benefits`) dengan
region **Singapore** aktif. Data kuota di konsol terlambat beberapa menit,
jadi jangan mengandalkan angka di layar untuk request terakhir.

---

## 9. Pesan Error (Bahasa Indonesia)

Error provider diterjemahkan sebelum sampai ke user. Pesan asli tetap
disimpan di `providerMessage` untuk troubleshooting.

| Kode internal | Kapan muncul | Pesan ke user |
|---|---|---|
| `FREE_QUOTA_EXHAUSTED` | `AllocationQuota.FreeTierOnly` / `FreeTierExhausted` | Kuota gratis model ini sudah habis. Pilih model lain atau aktifkan pay-as-you-go di QwenCloud. |
| `INSUFFICIENT_BALANCE` | `Arrearage` / HTTP 402 | Saldo QwenCloud tidak mencukupi atau ada tagihan tertunggak… |
| `INVALID_API_KEY` | `InvalidApiKey` / HTTP 401 | API key QwenCloud tidak valid atau bukan untuk region Singapore… |
| `ACCESS_DENIED` | `AccessDenied` / HTTP 403 | API key tidak punya akses ke model ini… |
| `MODEL_NOT_FOUND` | `ModelNotFound` | Model tidak ditemukan di akun QwenCloud… |
| `RATE_LIMITED` | `Throttling*` / HTTP 429 | Permintaan terlalu cepat. Tunggu beberapa saat lalu coba lagi. |
| `CONTENT_BLOCKED` | `DataInspectionFailed` | Prompt atau media ditolak oleh filter konten QwenCloud… |
| `INVALID_PAYLOAD` | `InvalidParameter` / HTTP 400 | Parameter tidak diterima QwenCloud… |
| `PROVIDER_TIMEOUT` | create > 60s / query > 30s | QwenCloud tidak merespons tepat waktu… |
| `PROVIDER_NETWORK_ERROR` | fetch gagal | Tidak dapat menghubungi QwenCloud… |
| `TASK_NOT_FOUND` | HTTP 404 | Task tidak ditemukan — hasil hanya tersimpan 24 jam. |

Error **tingkat task** juga dinormalisasi: DashScope bisa membalas
HTTP 200 dengan `output.task_status = "FAILED"` dan `output.code` berisi
`AllocationQuota.FreeTierOnly` atau `DataInspectionFailed`. Kode itu
dipetakan lewat `normalizeTaskError()` sehingga riwayat generation
menampilkan alasan Indonesia, bukan pesan Inggris mentah.

---

## 10. Troubleshooting

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
