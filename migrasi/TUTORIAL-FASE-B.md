# FASE B — Pindahkan 112 file (265 MB)

Panduan langkah demi langkah. Ikuti berurutan, jangan lompat.

**Prasyarat yang sudah selesai** (jangan diulang):

| Prasyarat | Status |
|---|---|
| Login berhasil di project baru | ✅ |
| 18 kebijakan akses Storage | ✅ |
| 8 bucket, 4 publik | ✅ |

---

## Yang akan dipindahkan

| Bucket | File | Ukuran |
|---|---|---|
| `user-uploads` | 47 | 152 MB |
| `social-character-references` | 45 | 13 MB |
| `dashboard-videos` | 19 | 106 MB |
| `social-story-audio` | 1 | 3 MB |
| 4 bucket kosong lain | 0 | 0 |
| **Total** | **112** | **±265 MB** |

---

## Sebelum mulai: 2 hal yang harus benar

### 1. Kuota project lama sudah pulih

Buka dashboard Supabase project **LAMA** (`ycovbqmezhrvzobxqnyp`) → menu **Storage**.

| Yang terlihat | Artinya |
|---|---|
| Daftar bucket dan file muncul | ✅ lanjut |
| Halaman error / `exceed_egress_quota` | ⏳ **berhenti**, tunggu kuota pulih |

### 2. Dua kunci rahasia sudah disalin

Anda butuh **service_role / secret key** dari **kedua** project. Ini kunci paling
kuat — jangan kirim lewat chat, jangan simpan di repo.

| Kunci | Letaknya |
|---|---|
| Kunci project **LAMA** | Dashboard lama → Project Settings → **API Keys** → `service_role` / secret |
| Kunci project **BARU** | Dashboard baru → Project Settings → **API Keys** → secret (`sb_secret_...`) |

Simpan sementara di Notepad. Nanti ditempel ke jendela PowerShell, **bukan** ke
dalam berkas.

---

## Langkah 1 — Buka PowerShell di folder kerja

Tekan **Win**, ketik `powershell`, tekan **Enter**.

Ketik satu per satu (tekan Enter tiap baris):

```powershell
cd C:\Users\lenovo\Desktop\genz-migrasi
node --version
```

**Yang harus terlihat:** nomor versi, misalnya `v20.11.0`.

- Kalau muncul `node : The term 'node' is not recognized` → Node.js belum
  terpasang. Pasang dari https://nodejs.org (pilih **LTS**), tutup PowerShell,
  buka lagi, ulangi.

---

## Langkah 2 — Unduh skrip terbaru

Skrip lama punya dua bug yang membuatnya **tidak menyalin apa pun**. Ambil versi
baru:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sugionoofficial/GEN-Z.AI/main/migrasi/migrate_bulk.mjs" -OutFile "migrate_bulk.mjs"
```

**Yang harus terlihat:** tidak ada pesan merah. Periksa:

```powershell
(Get-Item migrate_bulk.mjs).Length
```

Harusnya **lebih dari 7000**. Kalau angkanya jauh lebih kecil, unduhan gagal —
ulangi perintah di atas.

---

## Langkah 3 — Isi kunci rahasia

Tempel **satu per satu**. Akan ada kotak `>>` bila baris belum selesai —
tekan **Enter** sekali lagi.

```powershell
$env:OLD_SERVICE_KEY = "TEMPEL_KUNCI_PROJECT_LAMA_DI_SINI"
```

```powershell
$env:NEW_SERVICE_KEY = "TEMPEL_KUNCI_PROJECT_BARU_DI_SINI"
```

> Ganti tulisan di dalam tanda kutip. Jangan hapus tanda kutipnya.

Periksa bahwa keduanya terisi (jangan tampilkan isinya):

```powershell
if ($env:OLD_SERVICE_KEY) { "LAMA: terisi" } else { "LAMA: KOSONG" }
if ($env:NEW_SERVICE_KEY) { "BARU: terisi" } else { "BARU: KOSONG" }
```

**Yang harus terlihat:**

```
LAMA: terisi
BARU: terisi
```

> ⚠️ Kalau Anda menutup jendela PowerShell, dua variabel ini hilang dan harus
> diisi ulang. Jangan tutup jendela sebelum Fase B selesai.

---

## Langkah 4 — Jalankan

```powershell
node migrate_bulk.mjs
```

**Ini akan berjalan 10–40 menit** tergantung kecepatan internet. Jangan tutup
jendela. Layar akan bergerak sendiri — itu normal.

### Yang harus terlihat di awal

```
DARI (lama) = https://ycovbqmezhrvzobxqnyp.supabase.co
KE   (baru) = https://rvgioyenjgkprnssfpfr.supabase.co
  user-uploads: 47 objek
  social-character-references: 45 objek
  dashboard-videos: 19 objek
  social-story-audio: 1 objek
Total: 112 objek, ±265.0 MB
```

> **Perhatikan dua baris DARI / KE.** Kalau keduanya sama, hentikan dengan
> **Ctrl + C** — jangan lanjut.

> **Perhatikan "Total: 112 objek".** Kalau tertulis **0 objek**, hentikan dan
> laporkan ke saya. Itu artinya skrip lama masih terpakai.

### Yang harus terlihat selama proses

```
  [OK] [1/112] user-uploads/generate-input/....jpg (812 kB)
  [OK] [2/112] user-uploads/generate-input/....jpg (1.2 MB)
```

### Yang harus terlihat di akhir

```
Ringkasan: 112 diupload, 0 dilewati (sudah pernah), 0 gagal.
SELESAI.
```

---

## Kalau terputus di tengah jalan

**Jalankan perintah yang sama lagi:**

```powershell
node migrate_bulk.mjs
```

Skrip mencatat file yang sudah selesai di `.bulk_progress.json` dan melewatinya.
Yang muncul: `112 dilewati (sudah pernah)`.

---

## Langkah 5 — Beri tahu saya hasilnya

Kirim baris **Ringkasan** terakhir. Saya perlu tahu angkanya:

| Yang saya harapkan | Artinya |
|---|---|
| `112 diupload, 0 gagal` | ✅ selesai |
| `0 diupload, 112 dilewati` | ✅ sudah pernah jalan |
| ada angka gagal | saya bantu perbaiki per file |

---

## Setelah Fase B selesai

1. **Buka situs** → halaman riwayat → video 1 November
2. **Ctrl + Shift + R**
3. Video `motion-ui` (1.3 MB) seharusnya **bisa diputar**

Yang **tetap** tidak bisa diputar: video provider lama (Opus/MiniMax) yang
URL-nya bertanda tangan dan sudah kedaluwarsa. Itu bukan migrasi — itu batas
waktu dari provider, dan generate baru akan normal.

Baru setelah ini project lama boleh di-pause. **Jangan pause sebelum 112 file
dikonfirmasi masuk.**

---

## Kesalahan yang paling sering

| Pesan | Sebab | Perbaikan |
|---|---|---|
| `node : not recognized` | Node.js belum ada | pasang dari nodejs.org, buka ulang PowerShell |
| `OLD_SERVICE_KEY wajib` | variabel hilang (jendela ditutup?) | ulangi Langkah 3 |
| `HTTP 402` / `exceed_egress_quota` | kuota project lama masih terkunci | tunggu, lalu ulangi |
| `401` / `InvalidJWT` | kunci salah project (tertukar) | pastikan LAMA ke LAMA, BARU ke BARU |
| `Total: 0 objek` | skrip lama (bug folder) | ulangi Langkah 2 |
| `DARI` dan `KE` sama | env tidak terpakai | tutup PowerShell, ulangi dari Langkah 1 |
| berhenti tanpa pesan | koneksi terputus | jalankan lagi, otomatis lanjut |
