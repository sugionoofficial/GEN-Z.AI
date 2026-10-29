# Audit Kredit vs Token — auth token / API key / refresh token

Tanggal: 2026-10-29
Ruang lingkup: `api/*.js`, `functions/`, `lib/`, `navigation/`, `assets/js/`, `supabase/*.sql`
Pertanyaan yang dijawab: **apakah penggabungan auth token + apikey + refresh token bisa
memanipulasi kredit pemakaian sampai jadi 0 (atau dipakai gratis)?**

---

## 1. Kesimpulan singkat

| Skenario | Bisa? | Keterangan |
| --- | --- | --- |
| Menggabung/menukar **auth token**, **apikey anon**, **refresh token** lalu saldo kredit berubah | **Tidak** | Identitas selalu diambil ulang di server dari JWT (`/auth/v1/user`), body request diabaikan. Kredit hanya berubah lewat RPC di database, bukan lewat token. |
| Memakai layanan lalu **charge-nya jadi 0** (gratis) dengan trik token | **Tidak lewat token** | Potong kredit terjadi **sebelum** task dikirim, di server, pakai `user.id` hasil verifikasi. |
| Memakai layanan **gratis** dengan cara lain (celah RPC) | **YA — ini temuan utama** | `public.refund_generate_credits()` tidak punya `REVOKE`, jadi bisa dipanggil langsung dari luar lewat PostgREST untuk **menambah kredit sendiri tanpa bayar**. |
| **Mengosongkan kredit orang lain** (jadi 0) | **Belum bisa dipastikan** | Bergantung pada ACL `deduct_generate_credits()` yang definisinya tidak ada di repo. Kalau RPC itu juga terbuka, siapa pun bisa memotong saldo user lain. |

Ringkasnya: **bukan "penggabungan token" yang berbahaya**, tapi **hak akses fungsi RPC kredit
di database**. Token hanya menentukan *siapa* yang login; yang menentukan *apakah kredit bisa
diubah* adalah ACL fungsi `SECURITY DEFINER` + RLS tabel `profiles`.

---

## 2. Bagaimana kredit sebenarnya berubah

Tidak ada satu pun kode client yang menulis ke `profiles.credits`:

- semua `supabase.from("profiles")` di client hanya `.select(...)` (0 pemakaian `.update`),
- `admin-control/topup/topup-approval.js:219` bahkan mencatat "tidak ada lagi UPDATE profiles dari browser".

Alur yang sah:

1. **Generate video/gambar** — `api/generate.js`
   - `authenticateUser()` (`:499`) mengambil header `Authorization: Bearer <access_token>` (`:574`)
     lalu memverifikasi ke `/auth/v1/user`. `userId` = `user.id` dari hasil verifikasi.
   - Biaya dihitung dari konfigurasi model di database (bukan dari body request).
   - `deductGenerateCredits()` (`:1362`) → RPC `deduct_generate_credits` (`:1369`) dengan
     service role, **sebelum** task dikirim ke provider. Gagal potong = HTTP 402, tidak ada generate.
   - Kalau dispatch gagal → `refundGenerateCredits()` (`:1468`) memakai RPC `refund_generate_credits`.
2. **Fitur lain (vision, prompt studio, upscale, dsb.)** — `api/feature-credits.js:252/276`
   memanggil `charge_feature_credits` / `settle_feature_credits` dengan `p_user_id: user.id`
   (selalu dari JWT, lihat `:244` dan `:269`).
3. **Admin ubah kredit** — `api/admin-credit.js`: `verifyAdmin()` (`:158`) memverifikasi JWT
   (`/auth/v1/user`), lalu mengambil profil pakai **service role** dan mensyaratkan
   role `ADMIN`/`OWNER` + status `active`; penulisan `credits` (`:501`) juga service role.
4. **Refund otomatis** — `.github/workflows/upscale.yml:367` dan `upscale-photo.yml:381`
   memanggil RPC refund dengan `SUPABASE_SERVICE_KEY` (server-side).

Kesimpulan teknis: **identitas user tidak pernah diambil dari body/atau kombinasi token di client.**
`api/openkey-chat.js`, `api/generate-status.js`, `api/generate.js` semuanya `Bearer` → `/auth/v1/user`.

Pengamanan tambahan yang sudah ada:

- `assets/js/config.js:176,327` menolak service-role JWT di client dan hanya menerima anon/publishable key.
- `api/generate.js:237` (`sanitizeProviderResponse`) meredaksi `apiKey`, `access_token`, `token`, `secret`
  sebelum respons dikirim ke browser; `generate/assets/js/generate-request.js:806+` juga memblokir
  key sensitif (`api_key`, `refresh_token`, `auth_token`, `jwt`, dst.) agar tidak muncul di UI/diagnostik.
- Kredensial provider disimpan terenkripsi server-side; `api/admin-provider-credentials.js` hanya untuk admin.

---

## 3. Matriks kombinasi token (jawaban langsung pertanyaan)

| Kombinasi | Hasil | Kenapa |
| --- | --- | --- |
| `Authorization: Bearer <access_token user>` + `apikey: <anon key>` | Normal, kredit user itu dipotong | `apikey` hanya identitas project/gateway; identitas user = JWT |
| `access_token` user A + `refresh_token` user A | Normal | Refresh hanya memperpanjang sesi user yang sama (`assets/js/auth.js:263`, `generate-auth.js:661`) |
| `access_token` user A + `refresh_token` user B | Sesi berpindah ke **user B**, kredit **user B** yang dipakai | Bukan eskalasi: penyerang harus sudah memegang refresh token B. Ini risiko **pencurian token**, bukan manipulasi kredit |
| Hanya `apikey` anon (tanpa login) | Tidak bisa generate | Endpoint generate wajib Bearer valid → 401 |
| `apikey` anon + panggil RPC kredit langsung | **Bisa menambah kredit** (lihat F1) | Fungsi `SECURITY DEFINER` tidak punya `REVOKE` |
| `service_role key` (bocor) | **Bisa apa saja**, termasuk set kredit = 0 | Ini satu-satunya jalur "kredit jadi 0" secara langsung |
| API key provider (KIE/OpenKey/dll.) + access token | Tidak mengubah kredit | Key provider didekripsi di server; client tidak bisa menyelipkan key sendiri (`api/generate.js` tidak membaca `body.api_key`) |
| API key provider dipakai langsung ke provider (di luar GEN-Z.AI) | Tidak memotong kredit GEN-Z.AI, tapi juga tidak merugikan Anda **kecuali** key provider bocor ke client | Awas: kalau kredensial provider sampai terekspos, orang bisa generate langsung ke provider tanpa lewat sistem Anda |

Catatan penting soal "kredit jadi 0": tidak ada jalur di kode yang membuat saldo turun ke 0 oleh
token. Saldo hanya turun lewat `deduct_generate_credits` (server) atau admin (`api/admin-credit.js`).

---

## 4. Temuan

### F1 — KRITIS: `refund_generate_credits()` bisa dipanggil siapa saja (billing bypass)

Bukti: `supabase/feature-credit-history.sql:15-77`.

```sql
create or replace function public.refund_generate_credits(
    p_user_id uuid,
    p_amount numeric
)
returns numeric
language plpgsql
security definer          -- jalan sebagai owner, bypass RLS
set search_path to 'public'
...
    update public.profiles
       set credits = coalesce(credits, 0) + p_amount
     where id = p_user_id
```

Masalah: **tidak ada `REVOKE`/`GRANT` sama sekali** untuk fungsi ini. Bandingkan dengan fungsi
lain di repo yang sudah benar:

- `supabase/feature-credit-settings.sql:526-530` → `charge_feature_credits` & `settle_feature_credits`
  `revoke all ... from public, anon, authenticated; grant execute ... to service_role;`
- `supabase/generation-failure-credit-refund.sql:58-59` → `refund_failed_generation_credits` aman.

Di Postgres, fungsi baru otomatis dapat `EXECUTE` untuk `PUBLIC`, dan Supabase menambahkan default
privilege untuk `anon`/`authenticated`. Artinya siapa pun yang punya anon key (tersedia di JS publik)
bisa:

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/refund_generate_credits" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id":"<uuid-akun-sendiri>","p_amount":999999}'
```

Hasil: kredit bertambah sebesar apa pun, **tanpa login dan tanpa pembayaran** (bukan cuma
"kredit tidak berkurang" — malah bisa dijadikan sumber kredit gratis). Karena `p_user_id` bebas,
fungsi ini juga bisa menulis ke akun user lain, serta menandai `credit_refunded = true` pada baris
`generation_history` orang lain (lihat blok `update public.generation_history` di fungsi yang sama).

Perbaikan (sudah disiapkan): jalankan `supabase/credit-rpc-hardening.sql` di Supabase SQL Editor.
File itu mencabut `EXECUTE` dari `public`, `anon`, `authenticated` untuk semua fungsi kredit dan
hanya memberi `service_role`. Semua pemanggil sah (`api/generate.js`, `api/feature-credits.js`,
`api/admin-cancel-generation.js`, GitHub Actions) memakai service role, jadi tidak ada yang rusak.

### F2 — TINGGI (belum terverifikasi): ACL `deduct_generate_credits()`

Definisi fungsi ini **tidak ada di repo** (hanya dipanggil di `api/generate.js:1369`,
`supabase/feature-credit-settings.sql:275`, dan README). Karena tidak ter-version, kita tidak bisa
memastikan:

- apakah ada `revoke ... from anon, authenticated`,
- apakah `p_amount` negatif ditolak (kalau tidak: memanggil dengan nilai negatif = menambah kredit),
- apakah saldo dijaga tidak negatif (`credits >= p_amount`) dan dipotong secara atomik,
- apakah `p_user_id` boleh sembarang uuid (kalau ya: bisa mengosongkan kredit user lain).

Perbaikan: `credit-rpc-hardening.sql` sudah menutup ACL-nya (dynamic, cocok untuk signature apa pun).
Untuk sisa poin, cek definisinya:

```sql
select p.proname, p.oid::regprocedure as signature, p.prosecdef, p.proacl, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('deduct_generate_credits','refund_generate_credits');
```

Lalu pastikan ada penjagaan seperti:

```sql
if p_amount is null or p_amount < 0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
update public.profiles set credits = credits - p_amount
 where id = p_user_id and credits >= p_amount
returning credits into v_new;
if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
```

### F3 — SEDANG (perlu dicek): RLS & hak kolom `profiles`

Skema/RLS `profiles` tidak ikut di repo, jadi tidak bisa dipastikan dari kode. Yang perlu dipastikan:
user biasa **tidak** bisa `PATCH /rest/v1/profiles?id=eq.<dirinya>` dengan `{"credits": 0}`.
Cek:

```sql
select policyname, cmd, qual, with_check from pg_policies
 where schemaname='public' and tablename='profiles';

select grantee, privilege_type, column_name
  from information_schema.column_privileges
 where table_schema='public' and table_name='profiles'
   and grantee in ('anon','authenticated');
```

Kalau ada policy `UPDATE` untuk `authenticated` tanpa pembatasan kolom, tambahkan proteksi kolom:

```sql
revoke update (credits) on public.profiles from anon, authenticated;
```

atau trigger yang menolak perubahan `credits` kecuali pemanggilnya service role/admin:
`if current_setting('role', true) <> 'service_role' then raise exception 'CREDITS_READ_ONLY'; end if;`

### F4 — RENDAH: token di localStorage

`assets/js/auth.js:256-330` dan `generate/assets/js/generate-auth.js:651-780` menyimpan
`access_token` + `refresh_token` di localStorage. Ini bukan celah kredit, tapi kalau ada XSS,
penyerang dapat **memakai kredit korban** (bukan mengubah saldo). Mitigasi yang sudah ada:
rotasi refresh token saat refresh; tambahkan pencabutan sesi saat ganti password dan
`audit_log` untuk refresh token yang dipakai berkali-kali (token replay).

### F5 — RENDAH: kejujuran `credit_refunded`

`refund_generate_credits` (F1) bisa menandai `credit_refunded = true` di baris history user lain
dalam radius 2 jam. Setelah ACL diperketat, ini ikut tertutup.

---

## 5. Langkah perbaikan (urut prioritas)

1. Jalankan `supabase/credit-rpc-hardening.sql` (F1 + F2 ACL).
2. Verifikasi ACL dengan query di bagian akhir file migration; uji curl di atas harus balas
   `permission denied` / 401-403.
3. Cek RLS + hak kolom `profiles` (F3), tambahkan `revoke update (credits)` atau trigger.
4. Masukkan definisi `deduct_generate_credits` (dan `refund_generate_credits`) ke repo Supabase
   sebagai migration supaya bisa diaudit dan tidak "hilang" lagi.
5. Pastikan `SUPABASE_SERVICE_ROLE_KEY` tidak pernah ada di bundle client (sudah dijaga
   `assets/js/config.js`) dan rotasi bila pernah terekspos.
6. Opsional: log setiap pemanggilan RPC kredit + alert bila ada penambahan kredit tanpa
   transaksi `topup`/admin yang sah.

---

## 6. Yang tidak bisa diverifikasi dari repo ini

- Definisi asli `deduct_generate_credits()` dan ACL fungsi kredit di database produksi
  (repo hanya memuat sebagian migration; sisanya dibuat manual di SQL Editor).
- RLS/kolom privilege tabel `profiles`, `generation_history`, `feature_credit_transactions`.
- Nilai `SUPABASE_ANON_KEY` yang beredar di client (normal) dan apakah service role key pernah bocor
  (cek riwayat commit & log Worker).

Semua poin di atas bisa dicek dalam < 5 menit lewat query di bagian §4/§5 di Supabase SQL Editor.
