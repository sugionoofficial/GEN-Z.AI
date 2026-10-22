# QwenCloud (Alibaba Cloud Model Studio / DashScope) — Setup

Provider **`qwencloud`** menghubungkan GEN-Z.AI ke seluruh model video di
QwenCloud: **Wan 2.2 / 2.5 / 2.6** (text-to-video, image-to-video,
first/last frame, reference-to-video, Wan Animate) dan **HappyHorse 1.0 /
1.1** (text-to-video, image-to-video, reference-to-video, video edit).

Semua model yang menghasilkan video di akun QwenCloud sudah terdaftar —
total **17 model** (13 Wan + 4 HappyHorse). Kuota gratis: **50 detik**
per model Wan, **10 detik** per model HappyHorse.

---

## 1. File yang Terlibat

```
provider/qwencloud/client.js        HTTP client DashScope (create + polling)
models/qwencloud-video/specs.js     daftar 17 model (edit di sini untuk menambah)
models/qwencloud-video/factory.js   adapter generator (config, validate, payload)
models/qwencloud-video/index.js     registry model
supabase/qwencloud-provider-models.sql   seed provider + model + credit
supabase/qwencloud-model-quota.sql       tabel + view + trigger kuota per model
lib/generate/model-quota.js              re-export helper kuota (server)
admin-control/assets/js/model-quota.js   helper kuota (browser + server)
tests/qwencloud-video.test.mjs      unit test adapter & client
lib/generate/qwencloud-credit.js     billing per blok 5 detik
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
supabase/qwencloud-model-quota.sql
```

File ini membuat:

- baris `providers` dengan `provider_id = 'qwencloud'`
- 17 baris `models` (status `active`, credit default)
- 17 baris `model_quota` (Wan 50 detik, HappyHorse 10 detik)

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
| `happyhorse-1.1` | $0.14 / detik | $0.18 / detik (480P $0.07) |

Model dengan harga flat (tanpa resolusi), seperti Wan Animate, memakai
`credit_720p` sebagai harga tunggal. Di halaman **Edit Model** model
seperti ini tidak punya centang resolusi sama sekali, jadi tombol Simpan
tidak lagi memaksa memilih salah satu resolution (`resolutionIndependent`
diset otomatis oleh factory saat `resolutions` kosong).

#### Credit dihitung per blok 5 detik

QwenCloud menagih **per detik**, jadi credit di database adalah harga
untuk **5 detik (1 blok)** dan sistem mengalikannya otomatis:

| Durasi | Faktor | Contoh (`credit_720p = 30`) |
|---|---|---|
| 5 detik | 1x | 30 credit |
| 10 detik | 2x | 60 credit |
| 15 detik | 3x | 90 credit |

- Pembulatan ke atas: 6 detik → 2 blok.
- Model tanpa parameter durasi (Wan Animate, HappyHorse Video Edit) selalu 1x.
- HappyHorse 3–15 detik ikut aturan blok yang sama: 3s = 1x, 8s = 2x, 15s = 3x.
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
| t2v / i2v / r2v (Wan) | `/services/aigc/video-generation/video-synthesis` | `prompt`, `img_url`, `reference_urls` |
| HappyHorse (semua) | `/services/aigc/video-generation/video-synthesis` | `prompt`, `media[]` |
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
| `image_urls` | koleksi gambar | r2v (Wan 1–5, HappyHorse 1–9), video edit (0–5) |
| `image_url` | gambar tunggal | i2v, animate, HappyHorse i2v |
| `first_frame_url` + `last_frame_url` | dua blok gambar | kf2v |
| `video_urls` | koleksi video | r2v |
| `video_url` | video tunggal | animate, HappyHorse video edit |
| `audio_url` | audio | t2v / i2v (2.5 & 2.6) |
| `prompt` | textarea | semua |
| `negative_prompt` | textarea | t2v / i2v / kf2v |
| `aspect_ratio` | enum | t2v / r2v (dikirim sebagai `ratio` di HappyHorse) |
| `resolution` | enum | t2v / i2v / r2v / kf2v |
| `duration` | enum (Wan) / slider 3–15 detik (HappyHorse) | t2v / i2v / r2v / kf2v |
| `mode` | enum (`wan-std`, `wan-pro`) | animate |
| `prompt_extend` | boolean | t2v / i2v / kf2v / r2v (Wan saja) |

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
    kind: "t2v",                 // t2v | i2v | kf2v | r2v | animate | video-edit
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

### Model gaya HappyHorse

HappyHorse (dan model DashScope lain yang memakai `media[]`) memakai gaya
payload berbeda. Tambahkan `payloadStyle: "happyhorse"` dan ganti
`durations` dengan `durationRange`:

```js
{
    id: "qwen-happyhorse-1.1-t2v",
    dashscopeModel: "happyhorse-1.1-t2v",
    name: "HappyHorse 1.1 Text to Video",
    kind: "t2v",
    payloadStyle: "happyhorse",
    type: "text-to-video",
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    resolutions: ["720P", "1080P", "480P"],
    durations: [],                       // tidak dipakai
    durationRange: { min: 3, max: 15 },  // slider integer
    defaultDuration: "5",
    negativePrompt: false,
    audioTrack: false,
    shotType: false,
    maxPrompt: 2500
}
```

Perbedaan payload yang ditangani factory:

| Hal | Wan | HappyHorse |
|---|---|---|
| Ukuran / rasio | `parameters.size` = `"1280*720"` | `parameters.ratio` = `"16:9"` |
| Media | `input.img_url` / `input.reference_urls[]` | `input.media[{ type, url }]` — `first_frame`, `reference_image`, `video` |
| Durasi | enum `5` / `10` / `15` | integer bebas `3`–`15` |
| Prompt tambahan | `prompt_extend`, `shot_type` | tidak ada |

Catatan video edit: `kind: "video-edit"` hanya mengirim
`parameters.resolution` — tanpa durasi dan tanpa rasio. Durasi output
mengikuti video sumber (maksimal 15 detik), jadi credit-nya selalu **1x**.

---

## 8. Kuota Gratis QwenCloud

Aturan resmi QwenCloud yang memengaruhi provider ini:

| Aturan | Konsekuensi di GEN-Z.AI |
|---|---|
| Kuota gratis **hanya region Singapore** (API key + endpoint Singapore) | `DASHSCOPE_BASE_URL` lain (Beijing/Frankfurt) akan ditagih penuh dari detik pertama |
| Berlaku **90 hari** sejak aktivasi akun atau rilis model | Kuota tidak dipause walau tidak dipakai; sisa kuota hangus saat kedaluwarsa |
| **Per model**, tidak bisa digabung / dipindah | 17 model = 17 kuota terpisah, tidak otomatis dialihkan kalau satu habis |
| Snapshot bertanggal (mis. `wan2.6-t2v-2026-09-01`) dihitung **model terpisah** | Bisa didaftarkan sebagai model tambahan untuk mendapat kuota ekstra |
| Toggle **Free quota only** memblokir request saat kuota habis | Request gagal dengan `AllocationQuota.FreeTierOnly` → GEN-Z.AI menampilkan pesan kuota habis, credit user **otomatis direfund** |
| Tagihan tertunggak memblokir **semua** model walau kuota masih ada | Error `Arrearage` → pesan "Saldo QwenCloud tidak mencukupi" |

### Kuota HappyHorse lebih kecil

| Model | Kuota gratis | Efek |
|---|---|---|
| Wan 2.2 / 2.5 / 2.6 | 50 detik per model | 3–10 request uji coba |
| HappyHorse 1.0 / 1.1 | **10 detik per model** | hanya 1–2 request uji coba |

Kuota **tidak dipotong otomatis**. Kalau sisa kuota 6 detik dan kamu
meminta 10 detik dengan toggle *Free quota only* aktif, request **gagal**
(`AllocationQuota.FreeTierOnly`), bukan dipendekkan. Untuk uji coba pakai
durasi **3–5 detik**, dan sisakan sisa kuota untuk model produksi.

Harga HappyHorse juga lebih mahal dari Wan (Singapore, per detik):
480P $0.07 · 720P $0.14 · 1080P $0.18 (Wan 2.6: 720P $0.10 · 1080P $0.15),
karena itu credit default HappyHorse diset **±1.4x Wan**.

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
| `FREE_QUOTA_EXHAUSTED` | Kuota gratis habis (Wan 50 detik, HappyHorse 10 detik), toggle *Free quota only* menyala |
| `current user api does not support synchronous calls` | Header `X-DashScope-Async` hilang (tidak terjadi di adapter ini) |
| `INVALID_PAYLOAD` | Nilai `resolution` / `duration` di luar dukungan model (HappyHorse: integer 3–15) |
| Video hilang setelah 24 jam | `video_url` DashScope hanya valid 24 jam — unduh cepat |
| `PROVIDER_TIMEOUT` | Create 60 detik / polling 30 detik terlampaui |

Log provider tidak pernah memuat API key — semua secret di-redact sebelum
masuk Cloudflare Workers Logs.

---

## 11. Kuota per Model & Auto Nonaktif

QwenCloud tidak menyediakan endpoint untuk membaca sisa kuota gratis, jadi
GEN-Z.AI memakai **pelacakan pemakaian sendiri**:

| Bagian | Sumber |
|---|---|
| **Total kuota** | diisi manual oleh admin di halaman Edit/Tambah Model |
| **Pemakaian** | dihitung otomatis dari `generation_history` (durasi task berstatus `processing` atau `success`) |
| **Sisa & persentase** | view `qwencloud_model_quota` |
| **Auto nonaktif** | trigger `trg_qwencloud_quota` → `models.status = 'inactive'` |

### Tampilan admin

- **Edit Model → kartu "Kuota QwenCloud"**: persentase besar, progress bar,
  label `Sisa 32% · 16 detik dari 50 detik · kedaluwarsa 19 Jan 2027`,
  badge level (`Kuota aman` / `menipis` / `hampir habis` / `habis`).
- Input **Total Kuota**, **Pemakaian Manual**, **Kedaluwarsa**, dan tombol
  **Reset pemakaian & aktifkan model**.
- **Tambah Model**: blok kuota muncul otomatis hanya ketika provider
  **QwenCloud** dipilih.
- Kartu kuota **tidak muncul** untuk provider lain.

### Aturan penting

1. **Total 0 detik = pelacakan dimatikan.** Model tidak akan pernah
   dinonaktifkan otomatis; berguna saat sudah pindah ke pay-as-you-go.
2. **Pemakaian manual** dipakai untuk model tanpa parameter durasi
   (`qwen-wan2.2-animate-*` dan `qwen-happyhorse-1.0-video-edit`), karena
   durasi task-nya tidak tercatat di `generation_history`.
3. **Task gagal tidak dihitung** — hanya status `processing` dan `success`.
   Kalau task gagal, kredit user sudah direfund dan kuota tidak terpakai.
4. Saat pemakaian mencapai total, model langsung `inactive` sehingga
   **hilang dari halaman Generate** tanpa perlu aksi manual. Kolom
   `auto_disabled_at` menyimpan waktu kejadian.
5. **Reset pemakaian** memulai hitungan dari nol (`started_at = now()`) dan
   mengaktifkan kembali model yang dinonaktifkan otomatis. Model yang
   dinonaktifkan manual tetap `inactive` sampai diaktifkan sendiri.
6. Kalau total kuota dinaikkan melebihi pemakaian, model otomatis boleh
   dipakai lagi tanpa perlu reset.
7. Kuota yang sudah lewat `expires_at` ditandai **kedaluwarsa** di UI.

### Hitung manual lewat SQL

```sql
-- sisa kuota semua model QwenCloud
select model_code, status, total_seconds, used_seconds,
       remaining_seconds, remaining_percent, expires_at, auto_disabled_at
from public.qwencloud_model_quota
order by model_code;

-- ubah total / reset pemakaian
select public.admin_set_model_quota(
    (select id from public.models where model_id = 'qwen-happyhorse-1.1-t2v'),
    10,            -- total detik
    date '2027-01-19',
    0,             -- pemakaian manual
    true           -- reset + aktifkan kembali
);
```

---
