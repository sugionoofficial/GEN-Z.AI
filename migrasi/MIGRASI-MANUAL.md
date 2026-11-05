# Migrasi Manual — GEN-Z.AI ke Project Supabase Baru

Panduan ini dipakai **hanya bila project tidak bisa ditransfer** antar
organisasi (mis. organisasi asal masih *restricted* / dalam *grace period*
karena `exceed_egress_quota`).

> **Coba transfer dulu.** Transfer memindahkan kepemilikan + billing tanpa
> mengubah project ref, URL, atau API key — tidak perlu migrasi data sama
> sekali. Lihat bagian "Kenapa transfer lebih baik" di bawah.

- Project SUMBER: `ycovbqmezhrvzobxqnyp` (ap-southeast-1, PG 17)
- Project TARGET: `<project-ref-baru>`

### Region target

Region **tidak bisa** diubah setelah project dibuat (juga tidak ikut saat
transfer). Pilih dengan sadar:

| Region | Lokasi | Untuk pengguna |
|---|---|---|
| `ap-southeast-1` | Singapore | Indonesia / Asia Tenggara — **disarankan** |
| `ap-southeast-2` | Sydney | Australia / NZ — menambah ±60–100 ms per round-trip dari Indonesia |

Latensi DB tidak terasa (API berjalan di Cloudflare Worker), tetapi **Storage**
terasa: unduhan video 10–14 MB ke browser pengguna Indonesia jadi lebih lambat,
dan itu area yang paling banyak memakan egress.

> Target saat ini: **`rvgioyenjgkprnssfpfr` — ap-southeast-1 (Singapore)**,
> sama dengan region sumber sehingga latensi tidak berubah. Semua perintah di
> dokumen ini memakai host pooler Singapore (`aws-0-ap-southeast-1`).
>
> Nilai akhir, urutan cutover, dan pemeriksaan akhir ada di
> **`migrasi/CUTOVER-rvgioyenjgkprnssfpfr.md`**.

---

## Kenapa transfer lebih baik

| | Transfer | Migrasi manual (dokumen ini) |
|---|---|---|
| Project ref | **tetap** | berubah |
| `assets/js/config.js` | tidak diubah | **harus diubah** |
| Worker secrets (3) | tidak diubah | **harus diubah** |
| Redirect URL allow-list | tidak diubah | **harus diubah** |
| Data (25 user, 502 riwayat, 941 post run) | otomatis | pg_dump + restore |
| Storage (8 bucket, 112 objek, ~265 MB) | otomatis | unduh + unggah |
| Risiko | sangat rendah | sedang (auth + storage) |

Transfer hanya diblokir selama organisasi asal berstatus *restricted*.

---

## Akun Supabase berbeda

Bila organisasi baru berada di **akun Supabase lain** (bukan akun yang sama
dengan project sumber), beberapa hal berubah:

| Hal | Akun sama | Akun berbeda |
|---|---|---|
| Konektor/agen bisa melihat project target | ya | **tidak** |
| Yang menjalankan `pg_dump` / `psql` | agen | **Anda sendiri** |
| `service_role` key | agen bisa ambil | **Anda** salin dari dashboard |
| Yang mengubah Worker secrets | Anda | Anda |

Yang tetap berlaku: repo ini sudah menyimpan **semua** yang dibutuhkan
(`scripts/check-migration-readiness.mjs`, `migrasi/migrate_bulk.mjs`, dokumen
ini), jadi tidak ada langkah yang bergantung pada akses agen.

---

## Cek kesiapan sebelum mulai

Jalankan ini lebih dulu — hanya membaca, tidak mengubah apa pun:

```bash
export MIGRATION_SRC_REF=ycovbqmezhrvzobxqnyp
export MIGRATION_SRC_SERVICE_KEY='<service_role proyek sumber>'
export MIGRATION_DST_REF='<ref proyek baru>'
export MIGRATION_DST_SERVICE_KEY='<service_role proyek baru>'

node scripts/check-migration-readiness.mjs
```

Yang diperiksa:

- kelengkapan & format env, serta memastikan kunci memang `service_role`
  (kunci publishable akan ditolak),
- apakah project sumber masih **402** — ini penentu apakah langkah Storage bisa
  jalan sekarang atau harus ditunda,
- apakah schema `public` project target masih kosong (aman untuk restore),
- `pg_dump` tersedia dan versinya cukup (harus 17, sama dengan project sumber),
- target bukan project yang sama dengan sumber.

Keluar dengan kode 1 bila ada penghalang. Jangan lanjut sebelum hijau.

---

## 0. Yang harus disiapkan

1. **PostgreSQL 17 client** (`pg_dump`, `psql`) di komputer Anda:
   - Windows: `winget install --id PostgreSQL.PostgreSQL.17 -e`
   - macOS: `brew install postgresql@17`
   - Linux: `sudo apt install postgresql-client-17`
2. **Node.js ≥ 20** (`scripts/*.mjs`).
3. **Password DB** project sumber & target
   (Dashboard → Project Settings → Database → *Reset database password*;
   gunakan huruf+angka saja agar URL koneksi aman).
4. **Secret key (service_role)** kedua project.
5. Folder kerja terpisah, mis. `genz-migrasi-2026/`. **Jangan** taruh dump
   di dalam repo (sudah ditolak `.gitignore`).

URL koneksi (session pooler, port **5432** — jangan 6543):

```
SRC=postgresql://postgres.ycovbqmezhrvzobxqnyp:PASS_SRC@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
DST=postgresql://postgres.rvgioyenjgkprnssfpfr:PASS_DST@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

---

## 1. Dump skema + data dari project sumber

```bash
pg_dump "$SRC" --no-owner --no-acl --schema=public -f genz_public.sql
pg_dump "$SRC" --no-owner --no-acl --schema=auth --schema-only -f genz_auth_schema.sql
```

Ekspor tabel auth (data user **wajib**, kalau tidak semua akun hilang):

```bash
psql "$SRC" -c "\copy (SELECT id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_confirm_status FROM auth.users) TO 'auth_users.csv' WITH CSV HEADER"

psql "$SRC" -c "\copy (SELECT id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at FROM auth.identities) TO 'auth_idents.csv' WITH CSV HEADER"
```

Ekspor metadata Storage (dipakai untuk memulihkan `storage.objects`):

```bash
psql "$SRC" -c "\copy (SELECT id,bucket_id,name,owner,created_at,updated_at,last_accessed_at,metadata FROM storage.objects ORDER BY bucket_id,name) TO 'storage_objects_meta.csv' WITH CSV HEADER"

psql "$SRC" -c "\copy (SELECT id,name,owner,public,file_size_limit,allowed_mime_types,created_at,updated_at FROM storage.buckets) TO 'storage_buckets.csv' WITH CSV HEADER"
```

Cek cepat: `wc -l auth_users.csv` harus **26** (25 user + header).

---

## 2. Restore ke project target

Urutan **wajib** seperti ini:

```bash
# 2a. skema auth (tabel auth sudah ada di project baru; ini untuk trigger/function)
psql "$DST" -v ON_ERROR_STOP=1 --single-transaction -f genz_auth_schema.sql

# 2b. users & identities HARUS lebih dulu daripada public.profiles (FK)
psql "$DST" -c "\copy auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_confirm_status) FROM 'auth_users.csv' WITH CSV HEADER"

psql "$DST" -c "\copy auth.identities (id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) FROM 'auth_idents.csv' WITH CSV HEADER"

# 2c. skema + data public
psql "$DST" -v ON_ERROR_STOP=1 --single-transaction -f genz_public.sql
```

Bila FK ke `auth.users` gagal, jalankan 2b sebelum 2c (bukan sebaliknya).

Setelah restore, periksa:

```sql
select count(*) from auth.users;              -- harus 25
select count(*) from public.profiles;         -- harus 25
select count(*) from public.generation_history; -- harus 502
```

---

## 3. Storage (8 bucket, 112 objek, ~265 MB)

1. Buat bucket di target sesuai `storage_buckets.csv`
   (nama, `public`, `file_size_limit`, `allowed_mime_types` **harus sama**).
2. Sinkronkan file. Skrip `migrasi/migrate_bulk.mjs` di repo ini bisa dipakai
   ulang dengan mengganti URL — tetapi karena project sumber sedang
   *restricted*, Storage API-nya kemungkinan membalas **402** dan download
   akan gagal. **Unduh manual dari dashboard** bila skrip gagal:

   ```bash
   mkdir -p storage_dump && cd storage_dump
   # untuk tiap bucket & object di storage_objects_meta.csv:
   curl -H "Authorization: Bearer $SRC_SERVICE_KEY" -o "<path>" \
     "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/<bucket>/<path>"
   ```

3. Unggah ke target, lalu **selaraskan metadata** yang menentukan egress:

   ```sql
   -- WAJIB: tanpa ini objek dianggap no-cache dan unduhan berulang
   update storage.objects
      set metadata = jsonb_set(metadata, '{cacheControl}', '"31536000, immutable"');
   ```

   Objek yang diunggah lewat dashboard akan punya `cacheControl` default;
   perintah di atas menyamakannya dengan yang sekarang dipakai kode.
4. Terakhir, pulihkan baris metadata (`id`, `owner`, `created_at`) dari
   `storage_objects_meta.csv` bila Anda butuh tanda tangan URL lama tetap sah.
   Untuk aplikasi ini **tidak wajib** — semua URL dibangun ulang saat dibaca.

---

## 4. Auth & Realtime

1. **Auth settings** target harus menyalin sumber:
   - Site URL: `https://genzai.genzai-f37.workers.dev`
   - Redirect allow-list: `https://genzai.genzai-f37.workers.dev/**`,
     `http://localhost:3000/**`, `http://localhost:8787/**`
   - **Anonymous sign-in ON** (wajib untuk Live Support Chat)
   - Email signup ON, konfirmasi email ON
2. Trigger `on_auth_user_created` (membuat baris `profiles`) harus ada —
   sudah ikut di `genz_auth_schema.sql`. Verifikasi:
   `select tgname from pg_trigger where not tgisinternal and tgname like '%auth%';`
3. Realtime publication:
   ```sql
   alter publication supabase_realtime add table
     public.providers, public.support_conversations, public.support_messages;
   ```

---

## 5. Ubah aplikasi (WAJIB — ini pembeda utama dengan transfer)

1. `assets/js/config.js` → `SUPABASE_URL` + `SUPABASE_KEY` project **baru**
   (publishable key project baru).
2. Worker Cloudflare `genzai` → 3 secrets:
   ```
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
   ```
3. Tambahkan allowance untuk cross-check di test:
   `tests/supabase-project-config.test.mjs` membaca `assets/js/config.js`,
   jadi setelah diubah jalankan `npm test`.
4. Redeploy: `npm run deploy` atau push ke `main`.

---

## 6. Verifikasi pasca-migrasi

| Cek | Cara | Harapan |
|---|---|---|
| Login user lama | login dengan akun lama | berhasil (password ikut terpindah) |
| Sesi lama | buka aplikasi dengan sesi lama | mungkin perlu login ulang (JWT `iss` berubah) |
| Riwayat | buka History | 502 baris, media lama tampil |
| Storage | buka dashboard | thumbnail & video muncul |
| API | `GET /api/announcements` dengan token | `200`, bukan 402/500 |
| Live chat | buka panel chat sebagai tamu | anonymous sign-in jalan |

Catatan: **JWT lama tidak berlaku** di project baru karena `iss` berbeda.
Semua user akan diminta login ulang sekali. Itu normal dan tidak bisa dihindari.

---

## 7. Setelah selesai

1. Perbarui `migrasi/STATUS.md` (project ref baru).
2. Putuskan project lama: **pause** dulu 1–2 minggu sebagai cadangan, baru
   **delete** setelah yakin.
3. Pasang lagi GitHub integration di project baru
   (`Project Settings → Integrations`).
4. Pertimbangkan upgrade ke Pro sebelum kuota Free (5 GB uncached + 5 GB
   cached per organisasi) habis lagi.
