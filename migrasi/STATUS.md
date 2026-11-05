# Status Migrasi GEN-Z.AI — 2026-10-24

Ringkasan pemindahan aplikasi dari proyek Supabase lama ke proyek baru.

## Proyek
- BARU (target, aktif): `ycovbqmezhrvzobxqnyp` (ap-southeast-1, PG 17).
- LAMA (sumber, read-only): `boeamhglmvkatnycluaa` (ap-southeast-2) — Storage-nya terblokir
  HTTP 402 (kuota egress habis) sampai kuota bulanan reset atau plan di-upgrade.

## Selesai
- Skema: 730 statement DDL (43 tabel public + 1 view, fungsi, policy, RLS, FK, trigger, sequence).
- Data seluruh tabel: auth.users 6, auth.identities 6, profiles 6, models 24,
  generation_history 246, social_post_runs 117, support_messages 30, dll. (idempoten,
  `ON CONFLICT DO NOTHING` + `session_replication_role=replica`).
- 7 bucket storage terbuat (metadata baris `storage.buckets` utuh termasuk owner/timestamp).
- Finalisasi: validasi FK (0 invalid), setval sequence, trigger `on_auth_user_created`,
  publication realtime +3 tabel.
- Auth config proyek baru: anonymous sign-in ON, manual linking ON, rate limit
  email_sent 2/jam. (Toggle "require reauthentication" tidak ditampilkan dashboard baru —
  penyimpangan kecil yang dicatat, tidak menghalangi fungsi.)
- Konfigurasi aplikasi (`assets/js/config.js`, `index.html`, tests) menunjuk proyek baru.

## Tertunda
- Isi file storage: 71 objek (±380 MB). Jalankan ulang migrator sekali blokir 402 proyek
  lama terbuka: buka URL edge function `genz-migrator` di proyek baru (kode akses dari
  agen Arena), isi koneksi DB lama + secret key lama, klik MULAI — fase skema/data akan
  lewat cepat (idempoten) lalu file tersalin sampai SELESAI.
  Sumber fungsi: `migrasi/genz-migrator.mjs` (v8).
- Worker Cloudflare `genzai`: set secret SUPABASE_URL / SUPABASE_ANON_KEY /
  SUPABASE_SERVICE_ROLE_KEY ke nilai proyek baru, lalu `wrangler deploy`.
- Bersih-bersih proyek lama setelah storage selesai: hapus tabel `_bk.ddl` dan `_bk.sizes`.

## Berkas pendamping
- `migrasi/genz-migrator.mjs` — sumber edge function migrator (skema → data → storage → finalisasi).
- `migrasi/ui.html` — halaman UI migrator (fetch + JSON).
- `migrasi/RECOVERY.md` — panduan pemulihan manual via pg_dump/psql (cadangan).

---

## Koreksi 2026-11-05 — `config.js` ternyata masih proyek lama

Butir "Konfigurasi aplikasi menunjuk proyek baru" di atas **tidak benar** untuk repo
`main`: satu-satunya commit yang pernah ada di `assets/js/config.js` adalah
`c872bf9`, dan isinya masih proyek LAMA
(`boeamhglmvkatnycluaa` + `sb_publishable_blGIF...`). Commit `fd4f760` yang
disebut di `RECOVERY.md` tidak ada di history.

Akibatnya: browser login/register ke proyek lama (mendapat JWT project lama),
sementara Worker memakai proyek baru → semua panggilan API ditolak.

Sudah diperbaiki: `assets/js/config.js` kini menunjuk
`https://ycovbqmezhrvzobxqnyp.supabase.co` + `sb_publishable_dnOcQub...`.

Verifikasi kondisi proyek baru saat koreksi:

| Item | Nilai |
|------|-------|
| Status health | ACTIVE_HEALTHY (auth, db, pooler, rest, realtime, storage) |
| auth.users / profiles | 25 / 25 |
| generation_history | 502 |
| models / providers | 45 / 9 |
| storage | 8 bucket, 112 objek |
| anonymous sign-in | ON (dibutuhkan Live Support Chat) |
| Site URL / redirect | `https://genzai.genzai-f37.workers.dev` + `localhost:3000`, `localhost:8787` |

> Angka di atas lebih besar dari ringkasan awal (6 user, 71 objek), jadi pemakaian
> baru sudah terjadi di proyek baru. **Jangan** menjalankan ulang migrasi data
> dari proyek lama — bisa menimpa/menduplikasi data yang lebih baru.

### Yang masih harus dikerjakan di sisi Cloudflare

Secret Worker `genzai` harus memakai nilai proyek baru
(`wrangler secret put` atau dashboard → Settings → Variables and Secrets):

- `SUPABASE_URL` = `https://ycovbqmezhrvzobxqnyp.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = service_role / `sb_secret_...` proyek baru
- `SUPABASE_ANON_KEY` = `sb_publishable_dnOcQub...` (project yang sama)

Tanpa ini, API production tetap membalas 500 / "Server configuration is
incomplete" walaupun frontend sudah benar.

---

## Pembatasan egress 2026-11-05 — project TERKENA 402

Project `ycovbqmezhrvzobxqnyp` dibatasi Supabase dengan pesan:

```
Service for this project is restricted due to the following violations:
exceed_egress_quota. The project owner must upgrade their plan or remove
spend caps to restore service.
```

- Management API tetap `ACTIVE_HEALTHY`; database masih bisa di-query lewat
  konektor. Yang dibatasi adalah REST/Storage/Auth untuk client (HTTP 402).
- **Transfer ke organisasi baru DITOLAK** dengan dua alasan:
  1. `can't be transferred to a Free organization while the source
     organization is in an active grace period or under service restrictions`
  2. `Project is currently connected to GitHub` — integrasi harus diputus dulu.
- Karena transfer tertutup, jalur yang dipakai: **migrasi manual**.
  Panduan lengkap: `migrasi/MIGRASI-MANUAL.md`.
- Data saat migrasi: auth.users 25, profiles 25, generation_history 502,
  social_post_runs 941, models 45, providers 9, storage 8 bucket / 112 objek.

### Penyebab egress (sudah diperbaiki di kode)

| # | Penyebab | Bukti | Perbaikan |
|---|---|---|---|
| 1 | Upload memakai `cacheControl: "3600"` | 47 objek `user-uploads` tercatat `no-cache` di `storage.objects` | `"31536000, immutable"` |
| 2 | `voice-previews` & `social-video` tanpa aturan retensi | 16 file umur 3h15j, 4 file umur 3h3j | TTL 30 hari & 7 hari |
| 3 | Signed URL selalu berubah → browser tidak pernah cache | video 10–14 MB diunduh ulang penuh | (dokumentasi; lihat STORAGE-RETENTION.md) |

### Target migrasi final: project baru di akun/org berbeda, region ap-southeast-2

- Project target dibuat di **organisasi baru pada akun Supabase berbeda** →
  konektor/agen **tidak bisa melihat** project tersebut. Seluruh langkah
  dijalankan pemilik akun memakai `migrasi/MIGRASI-MANUAL.md`.
- Region target **`ap-southeast-2` (Sydney)**, bukan Singapore. Latensi DB
  tidak terasa (API di Cloudflare Worker) tetapi Storage terasa: unduhan video
  10–14 MB ke pengguna Indonesia lebih lambat.
- Alat bantu baru: `scripts/check-migration-readiness.mjs`
  (`npm run check:migration`) — memeriksa env, jenis kunci (menolak
  publishable/anon), status 402 sumber, schema target kosong, dan versi
  `pg_dump` **sebelum** ada data disentuh.
- Syarat yang masih menahan: Storage sumber masih 402, sehingga langkah pindah
  file harus menunggu kuota pulih (upgrade Pro atau reset siklus billing).

### Target final (2026-11-05): `rvgioyenjgkprnssfpfr` — ap-southeast-1

- Project dibuat ulang di **Singapore** (bukan Sydney) → region sama dengan
  sumber, latensi tidak berubah untuk pengguna Indonesia.
- Berada di **akun Supabase berbeda**: `get_project` lewat konektor ditolak
  (403 "The app denied access for this call"), jadi seluruh langkah dijalankan
  pemilik akun.
- Nilai & urutan final: `migrasi/CUTOVER-rvgioyenjgkprnssfpfr.md`.
- `migrasi/migrate_bulk.mjs` naik ke **v3**: menyalin `Cache-Control` dari
  sumber (dulu dipaksa `max-age=3600` sehingga objek hasil migrasi tercatat
  cache pendek → memicu egress).
- **Peringatan urutan:** deploy `config.js` sebelum data & storage siap membuat
  situs tampil kosong. Urutan aman: skema+data → storage → auth config →
  config.js + secrets → deploy.

### Fase D selesai di repo (2026-11-05)

`assets/js/config.js` + `.dev.vars.example` + seluruh fixture test sudah
dipindahkan ke **`rvgioyenjgkprnssfpfr`** memakai
`npm run cutover -- --ref rvgioyenjgkprnssfpfr --publishable …`.

| Item | Status |
|---|---|
| `config.js` (URL + publishable key) | ✅ project baru |
| `.dev.vars.example` | ✅ project baru |
| Fixture test (11 file) | ✅ project baru |
| `npm test` | ✅ 1370 pass |

**Sisa yang hanya bisa dilakukan pemilik akun:**

1. 3 secrets Worker Cloudflare `genzai` → lihat nilai di
   `CUTOVER-rvgioyenjgkprnssfpfr.md` Fase D.
2. Fase A (pg_dump skema + data), Fase B (storage, tunggu kuota), Fase C
   (auth config) di project baru.
3. **Deploy hanya setelah 1–3 selesai** — kalau tidak, situs tampil kosong.

Catatan: alat `npm run cutover` kini membaca ref aktif dari `config.js`
(bukan konstanta yang cepat usang), dan menolak jalan bila `--ref` sama
dengan ref aktif kecuali diberi `--off`.

### Backup penuh siap + lubang Fase A ditutup (2026-11-05)

Percobaan menyalin data lewat kanal tool/konektor **dihentikan** — volume
±11 MB dengan `jsonb` + kolom array terpotong oleh kanal, sehingga salinan
tidak bisa dibuktikan utuh. Penggantinya: toolkit yang dijalankan sekali dari
komputer sendiri, lengkap dengan bukti verifikasi.

| Berkas | Fungsi |
|---|---|
| `migrasi/backup-penuh.sh` | `dump` / `restore` / `verify` dalam satu skrip |
| `migrasi/BACKUP-PENUH.md` | panduan langkah demi langkah |
| `migrasi/verify-restore.sql` | 60 tabel + struktur, PASS/GAGAL otomatis (aman di-commit) |
| `migrasi/export-fingerprint.sql` | checksum isi baris (**rahasia**, simpan di luar repo) |
| `tests/backup-toolkit.test.mjs` | 14 test mengunci perilaku di atas |

**Lubang yang ditemukan & ditutup.** Fase A sebelumnya menganjurkan
`pg_dump --schema=public` saja dengan alasan skema `auth` "dikelola Supabase".
Kalau dijalankan apa adanya, hasilnya **60 tabel utuh tetapi 25 akun pengguna
hilang**, tanpa satu pun error saat restore. Sekarang:

- data `auth.users` + `auth.identities` di-dump sebagai langkah **wajib**
  (bukan opsional) dan prosesnya **berhenti** bila berkas itu kosong;
- restore memakai `ON_ERROR_STOP=1` + `session_replication_role = replica`
  sehingga berhenti pada error pertama, bukan gagal senyap;
- urutan restore dikunci: pre → public → auth → storage → post
  (`profiles` ber-FK ke `auth.users`, jadi auth tidak boleh didahulukan);
- dua baris `CREATE SCHEMA public` / `ALTER SCHEMA public OWNER TO` dibuang
  dari dump, karena skema `public` sudah ada di target (sebelumnya ini membuat
  restore selalu gagal di baris pertama).

**Inventaris sumber yang diverifikasi langsung dari DB** (bukan perkiraan):
60 tabel / 4.449 baris, 25 user, 25 identitas, 8 bucket / 112 objek,
60 tabel RLS aktif, 53 policy, 9 trigger public + 2 trigger auth,
66 fungsi public, 5 sequence, PostgreSQL 17.11.

**Temuan kecil:** `profiles.role` berisi `'OWNER'`/`'USER'` (huruf besar),
bukan `'admin'`. Pemeriksaan awal memakai `role = 'admin'` dan menghasilkan 0 —
alarm palsu. `verify-restore.sql` kini memeriksa `role = 'OWNER'` (nilai
sebenarnya 1) karena akun itulah yang harus selamat agar panel admin tetap bisa
dimasukki.

**Keputusan keamanan:** repo ini **publik**. Checksum md5 atas isi baris
`provider_credentials` dan `free_credit_secret_config` (API key provider +
password pepper) setara membocorkan verifier yang bisa di-brute-force offline,
jadi checksum itu **tidak** masuk git — hanya di `supabase/backup/`
(di-.gitignore). Berkas yang di-commit hanya berisi jumlah baris + struktur.
Test `tests/backup-toolkit.test.mjs` menolak commit bila ada md5 32-hex di
berkas migrasi.

Fungsi bantu sementara `_bk_*` di project sumber **sudah dihapus** (diverifikasi
0 sisa).

### Keputusan: konektor Supabase TETAP di akun lama (2026-11-05)

Sempat dipertimbangkan memindahkan konektor Supabase ke akun pemilik
`rvgioyenjgkprnssfpfr` agar agen bisa mengerjakan Fase A/C langsung.
**Diputuskan: tidak sekarang.** Alasan:

1. Pekerjaan yang menahan semuanya (`pg_dump` + `restore` Fase A) tetap harus
   berjalan dari komputer pemilik — sandbox agen tidak punya `pg_dump`/`psql`
   dan koneksi TLS ke `*.supabase.co` diblokir, terlepas dari konektor mana
   yang terpasang.
2. Konektor kemungkinan memegang **satu akun pada satu waktu**. Berpindah ke
   akun baru berisiko menghilangkan akses ke project LAMA — padahal project
   lama masih dibutuhkan untuk **Fase B** (112 objek storage / ±265 MB diambil
   dari sana) dan sebagai pembanding verifikasi.
3. Nilai tambah konektor baru hanya Fase C (Site URL + redirect allow-list),
   yang bisa diselesaikan pemilik di dashboard dalam hitungan menit.

Konektor baru dipertimbangkan **setelah Fase B selesai**, saat akses ke project
lama tidak lagi diperlukan.

### ✅ FASE A SELESAI — data sudah di project baru (2026-11-05)

Dijalankan pemilik akun dari Windows memakai `migrasi/backup-penuh.ps1`.
Hasil terverifikasi di project `rvgioyenjgkprnssfpfr`:

| Cek | Target | Hasil |
|---|---|---|
| auth.users | 25 | **25** |
| auth.identities | 25 | **25** |
| profiles | 25 | **25** |
| models | 45 | **45** |
| generation_history | 502 | **502** |
| social_post_runs | 941 | **941** |
| storage.objects | 112 | **112** |
| profiles role OWNER | >=1 | **1** |
| blok COPY data public | 60 | **60** |

Berkas dump (di komputer pemilik, **jangan** di-commit — berisi PII):
`1_public_clean.sql` 265 KB, `1b_public_data.sql` 10.887 KB,
`2_auth.sql` 24 KB, `3_storage_meta.sql` 58,8 KB.

**Empat kegagalan berurutan yang harus dilalui** (semua sudah diperbaiki di
repo; dicatat agar tidak terulang):

| # | Gejala | Sebab | Perbaikan |
|---|---|---|---|
| 1 | `ParserError`, `Missing closing '}'` | here-string ter-indentasi + byte non-ASCII | ASCII murni, tanpa here-string |
| 2 | `variabel $SRC belum diisi` | `-File` membuat sesi baru | `$env:SRC` (diwarisi) |
| 3 | `function "rls_auto_enable" already exists` | fungsi milik platform Supabase ikut dump | buang DDL fungsi platform + event trigger saat dump |
| 4 | `violates foreign key constraint ... created_by_fkey` | data public dimuat sebelum `auth.users` | pisah skema vs data; urutan skema -> auth -> data |

Pelajaran utama: tambalan `session_replication_role = replica` **tidak**
bisa diandalkan (terbukti gagal di lingkungan pemilik), sehingga urutan
pemuatan dibuat benar secara struktural, bukan dengan mematikan pengecekan FK.

**Sisa pekerjaan:** Fase B (file storage 112 objek, tunggu kuota), Fase C
(auth config target), Fase D (3 secrets Worker + verifikasi akhir).

### ✅ VERIFIKASI FASE A: 60/60 tabel, 0 gagal (2026-11-05)

Hasil `migrasi/verify-restore.sql` di project `rvgioyenjgkprnssfpfr` —
**15 cek, semuanya OK**:

| cek | hasil | target |
|---|---|---|
| tabel_pass | **60** | 60 |
| tabel_gagal | **0** | 0 |
| tabel_bermasalah | - | - |
| auth.users / auth.identities | 25 / 25 | 25 / 25 |
| public.profiles | 25 | 25 |
| public.generation_history | 502 | 502 |
| public.social_post_runs | 941 | 941 |
| storage.objects | 112 | 112 |
| tabel_rls_aktif | 60 | 60 |
| policy | 53 | 53 |
| trigger_public | 9 | 9 |
| sequence_public | 5 | 5 |
| fungsi_public | 66 | >=60 |
| owner_ada | 1 | >=1 |

Struktur dan isi terbukti utuh: bukan hanya jumlah baris, tetapi RLS aktif di
seluruh 60 tabel, 53 policy, 9 trigger, 5 sequence, dan 66 fungsi. Akun OWNER
ada, sehingga panel admin bisa dimasuki.

**Fase A resmi SELESAI.** Lanjut Fase C (auth config) yang tidak butuh kuota,
lalu Fase B (storage) saat kuota pulih.

### ✅ APLIKASI HIDUP — login berhasil (2026-11-05)

Situs produksi `https://genzai.genzai-f37.workers.dev` sudah bisa login memakai
akun hasil migrasi. Rantai yang harus benar seluruhnya:

| Lapisan | Status | Bukti |
|---|---|---|
| Worker secrets (3) | OK | tidak ada lagi `InvalidKey` |
| Auth project baru | OK | `POST /auth/v1/token?grant_type=password` sukses |
| 25 akun hasil restore | OK | login diterima, bukan "user not found" |
| GRANT ke anon/authenticated | OK | setelah `perbaiki-grant.sql` |
| Cache skema PostgREST | OK | setelah `notify pgrst, 'reload schema'` |
| Profil terbaca | OK | nama/kredit/role muncul |

**Tiga bug berurutan yang terbongkar di tahap ini** (semua sudah diperbaiki,
1418 test pass):

| # | Gejala | Sebab | Perbaikan |
|---|---|---|---|
| 1 | `InvalidKey: ""` | secret Worker kosong | isi 3 secret di Cloudflare |
| 2 | 404 `profiles` | `pg_dump --no-privileges` membuang GRANT | hapus flag itu; `perbaiki-grant.sql` |
| 3 | `PGRST205` schema cache | `session_replication_role = replica` mematikan trigger DDL Supabase (`pgrst_ddl_watch`) | hapus `replica`; `notify pgrst` |

Pelajaran: bug #1 di daftar ini (FK `credit_transactions`) "diperbaiki" dengan
mematikan trigger, dan justru itulah penyebab bug #3. Menambal gejala tanpa
memeriksa apa lagi yang ikut dimatikan.

**Sisa:** Fase B (112 file storage, menunggu kuota) — fitur yang butuh file
(thumbnail, preview video, hasil generasi) belum normal. Fase D sudah beres
karena build/deploy hijau.
