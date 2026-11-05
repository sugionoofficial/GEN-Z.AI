# TUTORIAL BACKUP — dari nol sampai data pindah

Ditulis untuk **yang belum pernah memakai terminal**. Tidak ada langkah yang
dilewati. Ikuti berurutan.

**Waktu:** ±15 menit (paling banyak habis di langkah install).
**Risiko ke data lama:** nol. Proses ini hanya **membaca** project lama dan
**menulis** ke project baru. Tidak ada yang dihapus.

---

## Gambaran besar

```
[1] Pasang alat          [2] Ambil alamat + password     [3] Backup
    PostgreSQL      →        dari dashboard Supabase   →   pg_dump
                                                                 ↓
[6] Selesai              [5] Verifikasi               [4] Restore
    cek angka            ←   cek 60 tabel            ←   psql
```

Hasil akhir: project baru `rvgioyenjgkprnssfpfr` berisi 60 tabel, 4.449 baris
data, dan 25 akun pengguna — persis seperti project lama.

---

## Di mana perintah ini diketik?

Ada **dua tempat** yang berbeda, dan tidak boleh tertukar:

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  1. JENDELA TERMINAL        │      │  2. BROWSER (dashboard)      │
│     di komputer Anda        │      │     SQL Editor               │
├─────────────────────────────┤      ├──────────────────────────────┤
│ Langkah 1  pasang alat      │      │ Langkah 6  verifikasi         │
│ Langkah 4  dump (backup)    │      │ tempel verify-restore.sql     │
│ Langkah 5  restore          │      │                              │
└─────────────────────────────┘      └──────────────────────────────┘
        perintah pg_dump/psql              perintah SQL (SELECT ...)
```

**Aturan sederhana:** kalau perintahnya diawali `pg_dump`, `psql`, `cd`,
`mkdir`, `export`, atau `bash` → **terminal**. Kalau diawali `select`,
`with`, atau `create` → **SQL Editor**.

### Cara membuka terminal

| Sistem | Caranya | Yang Anda lihat |
|---|---|---|
| **Windows** | Tekan tombol **Start**, ketik `powershell`, klik **Windows PowerShell** | Jendela biru/hitam, teks berakhiran `>` |
| **Windows** (untuk Langkah 4–5) | Start, ketik `git bash`, klik **Git Bash** | Jendela hitam, teks berakhiran `$` |
| **macOS** | Tekan `⌘ + Space`, ketik `terminal`, tekan Enter | Jendela putih/hitam, teks berakhiran `%` atau `$` |
| **Linux** | `Ctrl + Alt + T` | Jendela terminal, teks berakhiran `$` |

> Tidak yakin sistem Anda apa? Windows punya tombol **Start** di kiri bawah dan
> jendela dengan tombol ✕ di kanan atas. macOS punya menu **Apple** (🍎) di
> kiri atas layar dan tidak punya tombol Start. Selain keduanya → Linux.

### Cara membuka SQL Editor

Browser → https://supabase.com/dashboard → pilih project → menu kiri
**SQL Editor** → tombol **New query** → tempel → **Run**.

### Tiga aturan supaya tidak bingung

1. **Jangan mengetik perintah terminal di SQL Editor.** `pg_dump` di sana akan
   dijawab `syntax error`.
2. **Jangan mengetik SQL di terminal.** `select …` di sana akan dijawab
   `command not found`.
3. **Setiap kali membuka terminal baru, Anda kembali ke folder awal.**
   Jalankan `cd` ke folder kerja dulu — lihat Langkah 3.

### Semua berkas yang dipakai

| Berkas | Dari repo | Dipakai di | Cara pakainya |
|---|---|---|---|
| `backup-penuh.sh` | `migrasi/backup-penuh.sh` | terminal | disimpan di folder kerja, dijalankan dengan `bash` |
| `verify-restore.sql` | `migrasi/verify-restore.sql` | browser | **disalin-tempel**, tidak disimpan |

Folder kerja (tempat `backup-penuh.sh` diletakkan dan tempat hasil backup
muncul):

```
Windows : C:\Users\<nama-anda>\Desktop\genz-migrasi
macOS   : /Users/<nama-anda>/Desktop/genz-migrasi
```

Anda tahu sudah berada di folder yang benar kalau baris terakhir sebelum tanda
`>` atau `$` menampilkan `genz-migrasi`, misalnya:

```
PS C:\Users\sugiono\Desktop\genz-migrasi>
```

---

## Langkah 1 — Pasang alat (sekali seumur hidup)

Anda butuh **PostgreSQL client**. Ini paket resmi PostgreSQL yang berisi dua
program: `pg_dump` (memfoto database) dan `psql` (menuangkannya ke database
baru). Gratis, ±50 MB, tidak berjalan di latar belakang.

### Windows

**Cara termudah:**

1. Tekan tombol **Start**, ketik `powershell`, klik **Windows PowerShell**.
2. Salin baris ini, tempel ke jendela itu, tekan Enter:

   ```powershell
   winget install PostgreSQL.17
   ```

3. Tunggu sampai muncul tulisan `Successfully installed`.
4. **Tutup** jendela PowerShell, lalu **buka lagi** (wajib — agar perintah baru
   terbaca).

**Kalau `winget` tidak tersedia:**

1. Buka https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Unduh **PostgreSQL 17** untuk Windows (64-bit).
3. Jalankan installer. **Cukup centang** bagian *Command Line Tools*.
   Komponen lain (server, pgAdmin, Stack Builder) tidak diperlukan — boleh
   dibiarkan tercentang, tidak apa-apa.
4. Bila installer memberi password untuk "superuser", catat saja; **tidak**
   dipakai di tutorial ini.

### macOS

```bash
brew install postgresql@17
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Tidak punya Homebrew? Buka https://brew.sh, salin satu perintah di sana, lalu
ulangi langkah di atas.

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y postgresql-client-17
```

### Cek berhasil — WAJIB

Di terminal, ketik:

```bash
pg_dump --version
```

**Berhasil** bila muncul sesuatu seperti:

```
pg_dump (PostgreSQL) 17.6
```

**Gagal** bila muncul `command not found` / `tidak dikenali`:

- Windows: tutup semua terminal, buka baru, coba lagi. Masih gagal → cari
  `C:\Program Files\PostgreSQL\17\bin` di File Explorer, lalu tambahkan ke
  *Environment Variables → Path*.
- Pastikan angka depannya **17**, bukan 14/15/16. Versi client lebih lama dari
  server bisa menolak memfoto.

---

## Langkah 2 — Ambil 2 password + 2 alamat database

Anda perlu **dua** kredensial: satu untuk project **lama**, satu untuk project
**baru**. Keduanya diambil dengan cara yang sama.

### 2a. Password database LAMA

1. Buka dashboard Supabase, pilih project **GEN-Z.AI**
   (ref `ycovbqmezhrvzobxqnyp`).
2. Menu kiri bawah → **Project Settings** → **Database**.
3. Cari **Database password** → klik **Reset database password**.
4. **Tulis password baru memakai huruf dan angka saja** — misalnya
   `genzLama2026`. Jangan pakai `@ # $ % / :` atau spasi. Alasannya: password
   itu akan disisipkan ke dalam satu baris alamat, dan karakter simbol akan
   memutus alamat tersebut.
5. **Catat passwordnya sekarang.** Dashboard hanya menampilkannya sekali.

> Kenapa harus reset? Supabase tidak pernah menampilkan password lama. Kalau
> Anda tidak pernah mencatatnya, reset adalah satu-satunya jalan. Ini **tidak**
> mengubah data dan **tidak** memutus aplikasi yang sedang jalan.

### 2b. Password database BARU

Ulangi langkah 2a untuk project **`rvgioyenjgkprnssfpfr`**. Pakai password
berbeda, misalnya `genzBaru2026`. Catat.

### 2c. Ambil 2 "alamat" (connection string)

1. Di dashboard, klik tombol **Connect** (biasanya di atas, dekat nama project).
2. Pilih tab **Session pooler** — **bukan** *Direct connection*, **bukan**
   *Transaction pooler*.
3. Salin **Connection string** yang muncul. Bentuknya:

   ```
   postgresql://postgres.ycovbqmezhrvzobxqnyp:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

4. Ganti tulisan `[YOUR-PASSWORD]` (termasuk tanda kurung siku) dengan
   password dari langkah 2a.
5. **Tiga hal yang harus benar** — kalau salah satu salah, proses gagal:

   | Harus | Kalau salah |
   |---|---|
   | Ada tulisan `session pooler` | `transaction pooler` → koneksi terputus di tengah |
   | Berakhiran `:5432` | `:6543` → sama, terputus di tengah |
   | `[YOUR-PASSWORD]` sudah diganti | lupa → error `password authentication failed` |

6. Ulangi untuk project baru. Bedanya hanya **ref** di depan
   (`postgres.rvgioyenjgkprnssfpfr`) dan password-nya.

**Sekarang Anda punya dua baris panjang.** Simpan di Notepad, beri nama:

```
LAMA : postgresql://postgres.ycovbqmezhrvzobxqnyp:genzLama2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
BARU : postgresql://postgres.rvgioyenjgkprnssfpfr:genzBaru2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

> Host `aws-0-…` bisa berbeda di akun Anda (mis. `aws-1-…`). **Pakai yang
> tertulis di dashboard Anda**, jangan yang di contoh ini.

---

## Langkah 3 — Siapkan folder kerja

Buat satu folder kosong, misalnya di Desktop, bernama `genz-migrasi`.

**Windows (PowerShell):**

```powershell
mkdir $HOME\Desktop\genz-migrasi
cd $HOME\Desktop\genz-migrasi
```

**macOS / Linux / Git Bash:**

```bash
mkdir -p ~/Desktop/genz-migrasi
cd ~/Desktop/genz-migrasi
```

Sekarang unduh berkas `backup-penuh.sh` dari repo
(`migrasi/backup-penuh.sh`) dan letakkan **di dalam** folder itu.

- Dari GitHub: buka berkasnya → tombol **Raw** → klik kanan → *Save as…* →
  simpan dengan nama **`backup-penuh.sh`** di folder tadi.
- Pastikan namanya **tidak** berubah jadi `backup-penuh.sh.txt`. Kalau hal itu
  terjadi, rename dan hapus `.txt`-nya.

**Pengguna Windows:** berkas `.sh` dijalankan lewat **Git Bash**, bukan
PowerShell. Git Bash biasanya sudah terpasang bersama Git — cari *Git Bash* di
menu Start. Kalau tidak ada, install dari https://git-scm.com/downloads
(tombol Next terus sampai selesai).

Kalau Anda tidak mau memakai Git Bash sama sekali, **lewati langkah 4 dan 5**
dan pakai cara alternatif di bagian
[Jalur Windows tanpa Git Bash](#jalur-windows-tanpa-git-bash).

---

## Langkah 4 — Backup (memfoto project lama)

Di **Git Bash**, pastikan Anda berada di folder yang benar:

```bash
cd ~/Desktop/genz-migrasi
ls
```

Harus terlihat `backup-penuh.sh`. Kalau tidak terlihat, Anda di folder salah.

Ketik dua baris ini (ganti dengan alamat Anda sendiri, **pakai tanda kutip
tunggal**):

```bash
export SRC='postgresql://postgres.ycovbqmezhrvzobxqnyp:genzLama2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
export DST='postgresql://postgres.rvgioyenjgkprnssfpfr:genzBaru2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
```

Lalu jalankan:

```bash
bash backup-penuh.sh dump
```

Yang akan Anda lihat, berurutan:

```
== Versi client
pg_dump (PostgreSQL) 17.6

== 1/5 skema + data public (60 tabel)
  OK   4821 baris

== 2/5 DATA auth.users + auth.identities (WAJIB — tanpa ini akun hilang)
  OK   78 baris (harus memuat 26 baris COPY: 25 user + header)

== 3/5 metadata storage.buckets + storage.objects (file menyusul di Fase B)
  OK   145 baris

== 4/5 referensi skema auth + trigger auth (tidak di-restore, untuk pembanding)
  OK   ...

== 5/5 ringkasan berkas
  OK   3.1M   ./genz-backup/1_public_clean.sql
  OK   58K    ./genz-backup/2_auth.sql
  OK   41K    ./genz-backup/3_storage_meta.sql

== SELESAI. Salin folder ./genz-backup ke tempat aman (berisi hash password & kredensial).
```

### Berhenti di sini kalau…

| Yang terlihat | Artinya | Lakukan |
|---|---|---|
| `2_auth.sql` **tidak muncul** di ringkasan 5/5 | Akun pengguna tidak ikut terfoto | **Jangan lanjut.** Jalankan `bash backup-penuh.sh dump` sekali lagi. Masih gagal → kabari saya |
| `password authentication failed` | Password salah atau `[YOUR-PASSWORD]` belum diganti | Perbaiki baris `SRC`, ulangi |
| `could not translate host name` | Alamat salah ketik / host beda | Salin ulang dari dashboard, bagian Session pooler |
| `port 6543` | Anda memakai Transaction pooler | Ganti ke **Session pooler** di dashboard |
| `pg_dump: command not found` | PostgreSQL belum terpasang | Ulangi Langkah 1 |
| Berhenti lama tanpa tulisan | Normal untuk tabel besar (7 MB) | Tunggu, jangan tutup jendela |

> Folder `genz-backup` berisi **hash password pengguna dan API key provider**.
> Jangan di-commit, jangan di-upload, jangan dikirim ke chat. Cukup disimpan
> di komputer.

---

## Langkah 5 — Restore (menuangkan ke project baru)

Masih di Git Bash, folder yang sama:

```bash
bash backup-penuh.sh restore
```

Yang akan Anda lihat:

```
== Restore ke TARGET (berurutan, berhenti di error pertama)
  -> ./genz-backup/0_pre.sql ... OK
  -> ./genz-backup/1_public_clean.sql ... OK
  -> ./genz-backup/2_auth.sql ... OK
  -> ./genz-backup/3_storage_meta.sql ... OK
  -> ./genz-backup/9_post.sql ... OK
  OK   restore selesai

== Verifikasi angka kunci (target vs sumber)
auth.users            = 25
auth.identities       = 25
public.profiles       = 25
public.models         = 45
public.generation_history = 502
public.social_post_runs   = 941
storage.objects       = 112
```

**Kalau berhenti dengan `GAGAL`**, jangan panik — data yang sudah masuk tetap
ada. Baca 20 baris error yang dicetak, cocokkan dengan tabel
[Kalau ada error](#kalau-ada-error), perbaiki, lalu jalankan ulang perintah
yang sama.

---

## Langkah 6 — Verifikasi (jangan dilewati)

Angka di atas hanya jumlah baris. Langkah ini memastikan **isinya** benar.

1. Buka dashboard project **BARU** → menu **SQL Editor** → **New query**.
2. Buka berkas `migrasi/verify-restore.sql` dari repo, salin **seluruh
   isinya**.
3. Tempel ke SQL Editor, klik **Run**.
4. Hasil terakhir harus seperti ini:

   | cek | hasil | target |
   |---|---|---|
   | `tabel_pass` | **60** | 60 |
   | `tabel_gagal` | **0** | 0 |
   | `auth.users` | 25 | 25 |
   | `auth.identities` | 25 | 25 |
   | `storage.objects` | 112 | 112 |
   | `tabel_rls_aktif` | 60 | 60 |
   | `policy` | 53 | 53 |
   | `trigger_public` | 9 | 9 |
   | `sequence_public` | 5 | 5 |
   | `owner_ada` | **1** | ≥1 |

**Kalau `owner_ada` = 0**, akun admin Anda tidak ikut — jangan lanjut, kabari
saya.

**Kalau `tabel_gagal` bukan 0**, kolom `gagal` berisi nama tabel yang
bermasalah. Kirimkan daftar itu ke saya.

---

## Jalur Windows tanpa Git Bash

Kalau Anda memakai **PowerShell** dan tidak ingin memasang Git Bash. Hasilnya
sama, hanya dipecah menjadi beberapa perintah.

**Persiapan:**

```powershell
mkdir $HOME\Desktop\genz-migrasi
cd $HOME\Desktop\genz-migrasi
$SRC = 'postgresql://postgres.ycovbqmezhrvzobxqnyp:genzLama2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
$DST = 'postgresql://postgres.rvgioyenjgkprnssfpfr:genzBaru2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
```

**Langkah A — ambil data (3 perintah):**

```powershell
pg_dump $SRC --no-owner --no-privileges --schema=public -f 1_public.sql
pg_dump $SRC --data-only --no-owner --table=auth.users --table=auth.identities -f 2_auth.sql
pg_dump $SRC --data-only --no-owner --table=storage.buckets --table=storage.objects -f 3_storage_meta.sql
```

Cek hasilnya:

```powershell
dir *.sql
```

Harus ada **tiga berkas**. Ukuran `2_auth.sql` harus puluhan KB — kalau 0 byte,
ulangi perintah kedua.

**Langkah B — masukkan ke project baru (SATU perintah):**

```powershell
psql $DST -c "set session_replication_role = replica;" -f 1_public.sql -f 2_auth.sql -f 3_storage_meta.sql -c "set session_replication_role = origin;"
```

> **Kenapa harus satu baris panjang?** Ketiga `-f` dan kedua `-c` di atas
> dijalankan `psql` **dalam satu sesi, berurutan**. Kalau Anda memecahnya jadi
> beberapa perintah terpisah, `set session_replication_role = replica` hilang
> begitu perintah itu selesai — lalu trigger dan cek foreign key aktif kembali,
> dan `2_auth.sql` bisa ditolak.

Akan muncul **2 baris error** seperti ini — **normal, abaikan**:

```
ERROR:  schema "public" already exists
ERROR:  must be owner of schema public
```

Penyebabnya: project baru memang sudah punya schema `public`. Sisa isinya tetap
masuk. Jangan tambahkan `ON_ERROR_STOP=1` di jalur ini, karena itu akan
menghentikan proses tepat di dua error tadi.

**Langkah C — cek hasil:**

```powershell
psql $DST -c "select (select count(*) from auth.users) as users, (select count(*) from public.profiles) as profiles, (select count(*) from public.generation_history) as history, (select count(*) from public.social_post_runs) as post_runs;"
```

Harus keluar:

```
 users | profiles | history | post_runs
-------+----------+---------+-----------
    25 |       25 |     502 |       941
```

Lalu lanjut ke **Langkah 6** untuk verifikasi penuh.

> Catatan: jalur ini **tidak** menjalankan `9_post.sql`, sehingga `id` sequence
> belum disinkronkan. Setelah yakin datanya benar, jalankan:
>
> ```powershell
> psql $DST -c "select setval(pg_get_serial_sequence('public.credit_change_audit','id'), coalesce((select max(id) from public.credit_change_audit),1), true);"
> ```
>
> Tanpa ini, penambahan baris baru berikutnya bisa gagal karena `id` sudah
> terpakai.

---

## Kalau ada error

| Pesan error | Artinya | Perbaikan |
|---|---|---|
| `password authentication failed for user "postgres"` | Password salah | Salin ulang password dari Notepad; pastikan tidak ada spasi di ujung |
| `could not translate host name` | Alamat salah | Ambil ulang dari dashboard → Connect → Session pooler |
| `server does not support SSL` | Memakai `psql` sangat lama | Pastikan PostgreSQL 17 |
| `FATAL: sorry, too many clients` | Koneksi pooler penuh | Tunggu 1 menit, ulangi |
| `ERROR: relation "public.xyz" does not exist` saat restore | Urutan berkas tertukar | Pastikan `1_public.sql` **sebelum** `2_auth.sql` |
| `aborting because of server version mismatch` | Client lebih lama dari server | Install PostgreSQL **17** |
| Restore berhenti, `2_auth.sql` OK tapi `profiles` = 0 | FK `profiles → auth.users` menolak | Jalankan `0_pre.sql` lebih dulu (skrip sudah melakukannya otomatis) |
| `ERROR: duplicate key value violates unique constraint` saat mengulang restore | Restore sebelumnya sempat masuk sebagian | Kosongkan tabel itu dulu: `psql $DST -c "truncate public.<tabel> cascade;"` lalu ulangi |

---

## Setelah selesai — urutannya penting

| # | Langkah | Catatan |
|---|---|---|
| 1 | ✅ Skema + data + auth | **Anda baru menyelesaikan ini** |
| 2 | File storage (8 bucket, 112 file, ±265 MB) | **Tunggu kuota Storage pulih** — pakai `migrasi/migrate_bulk.mjs` |
| 3 | Auth config di project baru (Site URL + redirect URL) | Dashboard → Authentication → URL Configuration |
| 4 | 3 secrets Worker Cloudflare | Lihat `migrasi/CUTOVER-rvgioyenjgkprnssfpfr.md` Fase D |
| 5 | Merge PR #330 | **paling akhir** |

**Jangan hapus atau pause project lama** sebelum langkah 2 selesai — file
storage masih diambil dari sana.

**Jangan merge PR #330 dulu.** Merge = deploy. Frontend sudah menunjuk project
baru, jadi kalau di-deploy sebelum langkah 2–4 selesai, situs akan tampil
kosong (tabel ada, tapi file video/gambar belum).

Setelah cutover, **semua pengguna harus login ulang**. Ini normal: sesi lama
ditandatangani kunci project lama. Password mereka **tidak** berubah, jadi
tinggal login seperti biasa.

---

## FAQ

**Apakah data lama bisa rusak?**
Tidak. Perintah `pg_dump` hanya membaca. Tidak ada satu pun langkah di tutorial
ini yang menghapus data di project lama.

**Password saya harus reset — apakah aplikasi yang sedang jalan terganggu?**
Tidak. Reset password database hanya mengganti kredensial koneksi langsung ke
database. Aplikasi memakai API key, bukan password ini.

**Boleh saya jalankan `dump` dua kali?**
Boleh. Berkas akan ditimpa. Aman.

**Boleh saya jalankan `restore` dua kali?**
Berbahaya — baris bisa dobel (`duplicate key`). Kalau perlu mengulang, lihat
baris terakhir tabel error di atas.

**Kenapa harus 2 project, tidak digabung saja?**
Karena project lama terkunci kuota egress (`exceed_egress_quota`) dan tidak bisa
ditransfer antar-organisasi. Memindahkan isinya adalah satu-satunya jalan tanpa
menunggu tagihan.

**Kalau saya macet di tengah?**
Kirim ke saya: (1) perintah yang Anda jalankan, (2) 10 baris terakhir yang
muncul. Dari dua hal itu biasanya penyebabnya langsung kelihatan.

---

## Kalau ingin jalur tanpa install sama sekali

Bilang saja ke agen. Struktur **60 tabel** (kolom, primary key, foreign key,
index, RLS, 53 policy, 9 trigger, 66 fungsi, 5 sequence) bisa dibangkitkan
agen dari database project lama menjadi **satu berkas SQL**. Anda cukup:

1. Buka project baru → **SQL Editor** → **New query**
2. Tempel seluruh isi berkas
3. Klik **Run**

Tidak ada yang perlu dipasang. Yang **tetap** butuh `pg_dump` hanya isinya
(4.449 baris / ±11 MB) — volume itu tidak bisa ditempel lewat chat karena
terpotong. Jadi jalur ini menghemat langkah install, tetapi tetap menyisakan
satu langkah data di kemudian hari.
