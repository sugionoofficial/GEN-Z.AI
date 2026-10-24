# RECOVERY — Migrasi Penuh GEN-Z.AI ke Proyek Supabase Baru (dari komputer Anda)

**Kenapa jalur ini:** workspace agen Arena sempat ter-reset sehingga berkas backup
hilang, TETAPI data di proyek lama `boeamhglmvkatnycluaa` **utuh, tidak berubah**.
Jalur ini memakai `pg_dump`/`psql` langsung dari komputer Anda: sekali jalan,
lengkap (termasuk 2 tabel besar), dan hasilnya tersimpan permanen di disk Anda.

- Proyek BARU: `ycovbqmezhrvzobxqnyp` (Singapore, ap-southeast-1) — masih kosong, konfigurasi auth sudah diterapkan agen.
- Aplikasi di repo sudah diarahkan ke proyek baru (commit `fd4f760`).
- ⏳ **KERJAKAN SEGERA** — proyek lama bisa di-pause otomatis kapan saja.

---

## 0. Persiapan (sekali saja)

1. **Install PostgreSQL 17 client** (menyediakan `pg_dump` & `psql`):
   - Windows: `winget install PostgreSQL.17` — atau installer dari enterprisedb.com (cukup centang *Command Line Tools*). Jika perintah tidak dikenal, pakai path penuh: `"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"` dst.
   - macOS: `brew install postgresql@17` lalu `export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"`
   - Linux: `sudo apt install postgresql-client-17`
2. **Node.js ≥ 18** (cek: `node -v`) — untuk skrip storage.
3. Buat folder kerja, mis. `genz-migrasi`. **Unduh `migrate_bulk.mjs`** (tombol di panel preview / kartu file di chat) ke folder itu.
4. **Password DB LAMA**: dashboard LAMA → Project Settings → Database → *Reset database password*. **Gunakan huruf+angka saja** (tanpa simbol) agar URL koneksi tidak bermasalah.
5. **Password DB BARU**: dashboard BARU → menu yang sama (reset bila lupa; huruf+angka saja).
6. **Secret key LAMA**: dashboard LAMA → Project Settings → API Keys (secret/service_role).
7. **Secret key BARU**: dashboard BARU → API Keys (`sb_secret_zaDnr…`).

Definisi URL koneksi (ganti `PASSWORD_LAMA` / `PASSWORD_BARU`):

- `URL_LAMA` = `postgresql://postgres.boeamhglmvkatnycluaa:PASSWORD_LAMA@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`
- `URL_BARU` = `postgresql://postgres.ycovbqmezhrvzobxqnyp:PASSWORD_BARU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`

(Port **5432** = session pooler — wajib untuk pg_dump/psql. Jangan 6543.)

---

## 1. Dump skema+data public (45 tabel, ±7 MB)

```bash
pg_dump "URL_LAMA" --no-owner --schema=public -f genz_public.sql
```

Bila gagal koneksi / "project paused" → dashboard LAMA → **Restore project**, ulangi.

## 2. Ekspor user auth + metadata (masih dari proyek LAMA)

```bash
psql "URL_LAMA" -c "\copy (SELECT instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,confirmation_token,confirmation_sent_at,recovery_token,recovery_sent_at,email_change_token_new,email_change,email_change_sent_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,phone,phone_confirmed_at,phone_change,phone_change_token,phone_change_sent_at,email_change_token_current,email_change_confirm_status,banned_until,reauthentication_token,reauthentication_sent_at,is_sso_user,deleted_at,is_anonymous FROM auth.users) TO 'auth_users.csv' WITH CSV HEADER"

psql "URL_LAMA" -c "\copy (SELECT provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id FROM auth.identities) TO 'auth_idents.csv' WITH CSV HEADER"

psql "URL_LAMA" -c "\copy (SELECT bucket_id,name,owner,created_at,updated_at FROM storage.objects ORDER BY bucket_id,name) TO 'storage_objects_meta.csv' WITH CSV HEADER"

psql "URL_LAMA" -c "\copy (SELECT version,name,created_by,idempotency_key,rollback FROM supabase_migrations.schema_migrations ORDER BY version) TO 'schema_migrations.csv' WITH CSV HEADER"

psql "URL_LAMA" -Atc "SELECT pg_get_triggerdef(t.oid) || ';' FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND NOT t.tgisinternal" -o trigger_auth.sql
```

Cek `auth_users.csv` berisi 6 baris data (+1 baris header). Buka `trigger_auth.sql` — isinya baris `CREATE TRIGGER "on_auth_user_created" ...;`.

## 3. Restore ke proyek BARU (WAJIB berurutan a→g)

```bash
psql "URL_BARU" -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version varchar PRIMARY KEY, statements text, name varchar, created_by varchar, idempotency_key varchar, rollback text);"

psql "URL_BARU" -c "\copy auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,confirmation_token,confirmation_sent_at,recovery_token,recovery_sent_at,email_change_token_new,email_change,email_change_sent_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,phone,phone_confirmed_at,phone_change,phone_change_token,phone_change_sent_at,email_change_token_current,email_change_confirm_status,banned_until,reauthentication_token,reauthentication_sent_at,is_sso_user,deleted_at,is_anonymous) FROM 'auth_users.csv' WITH CSV HEADER"

psql "URL_BARU" -c "\copy auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id) FROM 'auth_idents.csv' WITH CSV HEADER"

psql "URL_BARU" -v ON_ERROR_STOP=1 --single-transaction -f genz_public.sql

psql "URL_BARU" -f trigger_auth.sql

psql "URL_BARU" -c "\copy supabase_migrations.schema_migrations (version,name,created_by,idempotency_key,rollback) FROM 'schema_migrations.csv' WITH CSV HEADER"

psql "URL_BARU" -c "ALTER PUBLICATION supabase_realtime ADD TABLE public.providers, public.support_conversations, public.support_messages;"
```

(Catatan: langkah `d` butuh 1–3 menit. Bila perintah terakhir error "already member of publication" → abaikan, sudah benar.)

## 4. File storage (7 bucket, ±71 objek, ±380 MB)

Di folder `genz-migrasi` (tempat `storage_objects_meta.csv` berada):

Windows (Command Prompt):
```bat
set OLD_SERVICE_KEY=secret_key_LAMA
set NEW_SERVICE_KEY=secret_key_BARU
node migrate_bulk.mjs
```

macOS / Linux:
```bash
OLD_SERVICE_KEY=secret_key_LAMA NEW_SERVICE_KEY=secret_key_BARU node migrate_bulk.mjs
```

Skrip otomatis: membuat bucket yang kurang, mengunduh semua objek dari proyek lama,
mengunggah ke proyek baru. **Bila ada yang gagal: jalankan ulang perintah yang sama**
(melanjutkan yang gagal saja).

## 5. Pulihkan owner/timestamp storage

```bash
psql "URL_BARU" -f storage_fixup.sql
```

## 6. Verifikasi cepat

```bash
psql "URL_BARU" -c "select (select count(*) from auth.users) users, (select count(*) from public.profiles) profiles, (select count(*) from public.models) models, (select count(*) from public.generation_history) gh, (select count(*) from public.social_post_runs) spr, (select count(*) from storage.buckets) buckets, (select count(*) from storage.objects) objects;"
```

**Harapan: 6 | 6 | 24 | ≥246 | ≥117 | 7 | 71** → lalu **kabari agen di Arena** untuk verifikasi menyeluruh via konektor.

## 7. Penutup (dashboard + Worker)

1. Dashboard BARU → **Authentication**, 4 hal:
   - *Anonymous sign-in* → **ON**
   - *Manual linking* → **ON**
   - *Require reauthentication* (update password) → **ON**
   - Rate limit *email_sent* → **2/jam**
2. Cloudflare Worker (dari repo, cabang `arena/0ac25885-gen-z-ai`):
   ```bash
   npx wrangler secret put SUPABASE_URL            # isi: https://ycovbqmezhrvzobxqnyp.supabase.co
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # isi: sb_secret_zaDnr… (lengkap, dari dashboard baru)
   npx wrangler secret put SUPABASE_ANON_KEY       # isi: sb_publishable_dnOcQubqXG_iGvUMTPCuUw_fU0gkaYm
   npx wrangler deploy
   ```
   **JANGAN mengubah secret enkripsi / secret lain** — kredensial provider & token Facebook lama harus tetap bisa didekripsi.
3. Uji aplikasi: login (password lama), video dashboard, saldo kredit, gambar QRIS topup, referensi karakter sosmed. **Semua user harus login ulang** (sesi lama tidak dipindah — memang by design).
4. Setelah agen memverifikasi semuanya: bersih-bersih (hapus CSV/SQL di komputer Anda; DROP tabel bantu `_bk.ddl`/`_bk.sizes` di DB lama — minta agen; proyek lama boleh dihapus).

## Bila ada error

BERHENTI di langkah yang error → salin pesan errornya → kirim ke agen via chat Arena.
