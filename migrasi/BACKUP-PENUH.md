# BACKUP PENUH — dari `ycovbqmezhrvzobxqnyp` ke `rvgioyenjgkprnssfpfr`

Panduan ini melakukan **satu hal**: memindahkan **semua** data proyek lama ke
proyek baru, dengan bukti bahwa pemindahannya utuh.

> **Status saat ini:** proyek lama kena `exceed_egress_quota` (HTTP 402) untuk
> REST & Storage, **tetapi koneksi database (port 5432) tetap normal**. Karena
> itu seluruh backup di sini jalan sekarang, tanpa menunggu kuota pulih.
> Data di proyek lama **tidak** dalam bahaya — 402 tidak menghapus apa pun.

| | Sumber | Target |
|---|---|---|
| Project ref | `ycovbqmezhrvzobxqnyp` | `rvgioyenjgkprnssfpfr` |
| Region | `ap-southeast-1` (Singapore) | `ap-southeast-1` (Singapore) |
| Isi | 60 tabel / 4.449 baris, 25 user, 8 bucket / 112 objek | kosong |

---

## 0. Kamus singkat (baca ini kalau istilahnya asing)

Dua alat ini bukan aplikasi yang perlu dipelajari. Keduanya **hanya jalan
sekali**, lalu selesai.

| Nama | Analogi | Tugasnya |
|---|---|---|
| `pg_dump` | **mesin fotokopi** | Memfoto seluruh database menjadi **satu berkas** (`1_public.sql` + `2_auth.sql`) |
| `psql` | **pipa penyalur** | Menuangkan isi berkas itu ke database baru |

Keduanya bagian dari **PostgreSQL** — bukan dari Supabase, bukan dari repo ini.
Supabase memakai PostgreSQL di dalamnya, jadi alat resmi PostgreSQL bisa
membaca datanya langsung. Keduanya berupa program tanpa tampilan (hitam-putih
di terminal), dijalankan dengan mengetik satu baris perintah.

**Yang perlu Anda pahami hanya 3 hal:**

1. Pasang sekali → dapat dua alat itu.
2. Ketik 2 perintah → backup jadi.
3. Ketik 1 perintah → data masuk ke project baru.

Anda **tidak** perlu memahami isi perintahnya. Cukup salin-tempel.

**Kalau tidak ingin memasang apa pun:** bagian skema (60 tabel) bisa saya
kerjakan untuk Anda — saya punya akses ke database project lama, jadi saya bisa
membangkitkan satu berkas SQL berisi seluruh struktur tabel, lalu **Anda tinggal
menempelkannya ke SQL Editor** di dashboard project baru (tanpa install).
Yang tetap butuh `pg_dump` hanyalah **isinya** (4.449 baris data), karena
volumenya terlalu besar untuk ditempel lewat chat. Bilang saja kalau mau jalur
ini.

---

## 0b. Kenapa harus lewat komputer Anda, bukan lewat chat

Percobaan menyalin data lewat chat/konektor **dihentikan**. Alasannya konkret:

- Volume datanya ±11 MB (tabel `generation_history` 7,4 MB, `social_post_runs`
  3,5 MB). Kanal tool memotong output besar, sehingga salinan yang sampai
  **tidak utuh** dan tidak ada cara mendeteksinya dari dalam chat.
- Isinya `jsonb` dan kolom array. Menggabung ulang potongan teks berisiko
  menghasilkan SQL yang **valid secara sintaks tapi salah isinya**.
- Berkas SQL hasil `pg_dump` tidak bisa dibuktikan benar kecuali dengan
  membandingkan checksum — dan itu bagian dari panduan ini.

Yang **sudah** dikerjakan agen dan tidak perlu Anda ulangi: inventaris lengkap
60 tabel, dan **sidik jari checksum** semua tabel (dipakai untuk membuktikan
restore benar). Checksum mentahnya disimpan di `supabase/backup/fingerprint-source.txt`
  (di-.gitignore — **tidak** masuk repo, karena repo ini publik).

---

## 1. Persiapan (sekali saja)

1. **Install PostgreSQL 17 client** — inilah yang memberi Anda `pg_dump` &
   `psql` (dua alat di kamus bagian 0). Ukurannya ±50 MB, bukan aplikasi
   berjalan di latar belakang — hanya dua program yang dipanggil saat Anda
   mengetik perintah.
   - Windows: `winget install PostgreSQL.17` (atau installer enterprisedb.com,
     cukup centang *Command Line Tools*).
   - macOS: `brew install postgresql@17` lalu
     `export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"`
   - Linux: `sudo apt install postgresql-client-17`
   - Cek: `pg_dump --version` harus menampilkan **17.x** (versi client lebih
     lama dari server PG 17 bisa menolak dump).
2. **Node.js ≥ 18** untuk Fase B (`node -v`).
3. **Password DB proyek LAMA** → dashboard LAMA → Project Settings → Database →
   *Reset database password*. **Pakai huruf + angka saja** (tanpa simbol),
   supaya URL koneksi di shell tidak perlu di-escape.
4. **Password DB proyek BARU** → dashboard BARU, menu yang sama.
5. **Secret key BARU** (`sb_secret_…`) untuk Fase B.

> ⚠️ Port wajib **5432** (session pooler). Port 6543 (transaction pooler)
> memutus koneksi di tengah `pg_dump`. Skrip menolak port 6543 otomatis.

---

## 2. Backup (jalankan sekarang, ±1 menit)

Unduh `migrasi/backup-penuh.sh` dari repo ke folder kerja, lalu:

```bash
# PowerShell / cmd: pakai tanda kutip ganda dan jangan ada spasi di password
export SRC='postgresql://postgres.ycovbqmezhrvzobxqnyp:PASS_LAMA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
export DST='postgresql://postgres.rvgioyenjgkprnssfpfr:PASS_BARU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

chmod +x backup-penuh.sh
./backup-penuh.sh dump
```

Hasilnya folder `./genz-backup`:

| Berkas | Isi |
|---|---|
| `1_public_clean.sql` | 60 tabel + data public + RLS + 53 policy + 69 fungsi + 9 trigger + 5 sequence |
| `2_auth.sql` | **data** `auth.users` + `auth.identities` (25 user, hash password ikut) |
| `3_storage_meta.sql` | metadata `storage.buckets` + `storage.objects` (112 baris) |
| `4_auth_skema_referensi.sql` | skema auth milik Supabase — **referensi saja, jangan di-restore** |
| `5_trigger_auth.sql` | definisi trigger auth — **referensi saja** |
| `0_pre.sql`, `9_post.sql` | pembungkus restore (matikan trigger saat insert) |

**Ukuran normal** yang harus Anda lihat di bagian akhir output:

```
1_public_clean.sql   ±3 MB
2_auth.sql           ±60 KB   (26 baris COPY = 1 header + 25 user)
3_storage_meta.sql   ±40 KB
```

**Kalau `2_auth.sql` kosong atau jauh di bawah 20 KB → berhenti.** Artinya
koneksi berhasil tetapi dump auth gagal, dan melanjutkan restore akan
menghasilkan situs tanpa akun.

> Folder `genz-backup` berisi PII: hash password dan kredensial provider.
> Simpan di tempat aman, jangan di-commit, jangan dikirim lewat chat.
> `supabase/backup/` sudah masuk `.gitignore`.

---

## 3. Restore ke proyek baru

```bash
./backup-penuh.sh restore
```

Seluruh berkas dijalankan **dalam satu sesi `psql` dan satu transaksi**
(`--single-transaction`). Dua akibat yang penting untuk Anda:

- `set session_replication_role = replica` benar-benar berlaku saat data
  dimuat. Kalau setiap berkas dijalankan sebagai sesi terpisah, setting itu
  hilang lebih dulu, trigger dan cek foreign key menyala kembali, lalu
  `2_auth.sql` ditolak FK `public.profiles → auth.users`.
- Restore bersifat **semua-atau-tidak-sama-sekali**. Gagal di tengah = target
  kembali seperti sebelum restore, jadi aman diulang tanpa risiko baris dobel.

Urutan yang dijalankan skrip (jangan diacak):

1. `0_pre.sql` — `session_replication_role = replica` → trigger & cek FK mati
   supaya urutan INSERT tidak jadi masalah.
2. `1_public_clean.sql` — tabel, data, RLS, policy, fungsi, trigger.
3. `2_auth.sql` — user. **Harus setelah tabel**, karena `public.profiles`
   punya FK ke `auth.users`.
4. `3_storage_meta.sql` — daftar objek (file fisik menyusul di Fase B).
5. `9_post.sql` — trigger dinyalakan kembali + `setval` sequence.

Dua baris dibuang dari dump (`CREATE SCHEMA public;` dan
`ALTER SCHEMA public OWNER TO …`) karena skema `public` sudah ada di target.
Sisanya dijalankan dengan `ON_ERROR_STOP=1`, jadi **error pertama langsung
menghentikan** restore — tidak ada kegagalan senyap.

Kalau restore berhenti di tengah: karena satu transaksi, **tidak ada data
separuh** — target otomatis kembali seperti sebelum perintah dijalankan.
Baca pesan error yang dicetak, perbaiki penyebabnya, lalu jalankan ulang
perintah yang sama. Tidak perlu `truncate`.

---

## 4. Buktikan restore-nya benar (jangan dilewati)

Angka mentah dulu:

```bash
./backup-penuh.sh verify
```

Target nilai yang harus **sama** dengan sumber:

| Tabel | Harus |
|---|---|
| `auth.users` | 25 |
| `auth.identities` | 25 |
| `public.profiles` | 25 |
| `public.models` | 45 |
| `public.generation_history` | 502 |
| `public.social_post_runs` | 941 |
| `public.monitoring_health_checks` | 1400 |
| `storage.objects` | 112 |

Lalu checksum — buka **`migrasi/verify-restore.sql`** di SQL Editor
proyek **TARGET** dan jalankan. Query pertama memberi satu baris per tabel
dengan status `PASS` / `GAGAL`, query kedua memberi ringkasan.

**Target cutover: `tabel_pass` = 60, `tabel_gagal` = 0.**

Kenapa ini perlu padahal jumlah baris sudah cocok: jumlah baris bisa benar
sementara isinya tertukar atau terpotong (mis. kolom `jsonb` ter-truncate).
Checksum md5 atas baris terurut menangkap hal itu, dan tidak terpengaruh urutan
fisik tabel.

Bila ada `GAGAL (tabel tidak ada)` → restore belum sampai tabel itu.
Bila `GAGAL (jumlah baris)` → restore terhenti / terulang.
Bila `GAGAL (isi berbeda)` dengan jumlah baris yang sama → ada kolom yang
berubah saat restore; jangan lanjut ke Fase B sebelum ini hijau.

---

## 5. Setelah itu (urutan tidak boleh dibalik)

| # | Langkah | Panduan |
|---|---|---|
| A | Skema + data + auth | **panduan ini** |
| B | File storage 8 bucket / 112 objek / ±265 MB | `migrasi/migrate_bulk.mjs` (v3) — **tunggu kuota pulih** |
| C | Auth config target: Site URL + redirect allow-list | `CUTOVER-rvgioyenjgkprnssfpfr.md` Fase C |
| D | 3 secrets Worker Cloudflare `genzai` | `CUTOVER-rvgioyenjgkprnssfpfr.md` Fase D |
| E | Merge PR #330 (= deploy) | **paling akhir** |

**Deploy sebelum A–D selesai = situs tampil kosong** (frontend sudah menunjuk
`rvgioyenjgkprnssfpfr` sementara isinya belum ada). Itulah sebabnya PR #330
sengaja dibiarkan terbuka.

Karena hash password ikut dipindah, user tidak perlu reset password — tetapi
**semua user harus login ulang** setelah cutover, karena JWT lama ditandatangani
kunci proyek lama.

---

## 6. Yang TIDAK ikut oleh skrip ini

| Hal | Kenapa | Cara menanganinya |
|---|---|---|
| Berkas fisik storage | Butuh Storage API, terkena 402 | Fase B, `migrate_bulk.mjs` |
| Skema `auth` | Dikelola Supabase; versi target bisa beda | Sudah ada di target, jadi tidak di-dump |
| Edge function | Konektor menolak akses ke target | Deploy dari dashboard/CLI |
| `supabase_migrations.schema_migrations` | Riwayat migrasi repo, bukan data aplikasi | Opsional; lihat `MIGRASI-MANUAL.md` |
| Invoice / metode pembayaran | Melekat pada akun Supabase, bukan DB | Ikut akun, tidak bisa dipindah |

---

## 7. Setelah backup sukses

Proyek lama **jangan** di-pause atau dihapus sebelum Fase B selesai, karena
berkas storage masih diambil dari sana. Setelah semua hijau, baru boleh
di-pause (bukan dihapus) sebagai cadangan terakhir.
