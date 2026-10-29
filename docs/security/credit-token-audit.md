# Audit & Perbaikan — Kredit vs Token (auth token / API key / refresh token)

Tanggal audit: 2026-10-29
Project Supabase: **GEN-Z.AI** (`ycovbqmezhrvzobxqnyp`, region ap-southeast-1)
Ruang lingkup: `api/*.js`, `functions/`, `lib/`, `navigation/`, `assets/js/`, skema `public`
Pertanyaan: **apakah penggabungan auth token + apikey + refresh token bisa memanipulasi kredit pemakaian sampai 0?**

> Status: **semua temuan kritis di dokumen ini SUDAH diperbaiki langsung di database produksi**
> pada 2026-10-29. Migration idempotent: `supabase/credit-rpc-hardening.sql`.

---

## 1. Kesimpulan

**Token bukan jalur manipulasi kredit.** Yang menjadi jalur adalah **hak akses (ACL) fungsi
`SECURITY DEFINER` di schema `public`** yang terekspos PostgREST. Kondisi sebelum perbaikan
membuat siapa pun yang memegang anon key (tersedia publik di JS) bisa **mencetak kredit** atau
**menguras kredit akun mana pun sampai 0** — tanpa login.

| Skenario | Sebelum | Sesudah |
| --- | --- | --- |
| Gabung/ tukar `auth token` + `apikey anon` + `refresh token` → saldo berubah | Tidak bisa | Tidak bisa |
| `POST /rest/v1/rpc/refund_generate_credits` (anon, tanpa login) | **Bisa: cetak kredit bebas** | `permission denied` ✅ |
| `POST /rest/v1/rpc/refund_credit` (anon, tanpa login) | **Bisa: cetak kredit bebas** | `permission denied` ✅ |
| `POST /rest/v1/rpc/deduct_credit` dengan `p_user_id` korban | **Bisa: kuras saldo user lain jadi 0** | `permission denied` ✅ |
| `POST /rest/v1/rpc/deduct_generate_credits` (nilai negatif) | Ditolak guard di fungsi, tapi ACL terbuka | `permission denied` ✅ |
| `admin_cancel_generation` / `admin_set_model_quota` (anon) | **Bisa** (tanpa cek admin) | `permission denied` ✅ |
| `sum_profile_credits` / `count_*` / `get_active_user_ids` | Semua user login bisa baca | guard admin + anon dicabut ✅ |
| `PATCH /rest/v1/profiles {"credits": 0}` | Ditolak RLS (tak ada policy UPDATE) | dipertahankan + trigger penjaga ✅ |
| Pakai layanan lalu charge jadi 0 dengan trik token | Tidak bisa | Tidak bisa |

**Tidak ada bukti eksploitasi** ditemukan di ledger (lihat §6).

---

## 2. Bagaimana kredit sebenarnya berubah (dan kenapa token tidak berpengaruh)

- Identitas selalu diambil ulang di server dari JWT: `api/generate.js:499` (`authenticateUser`) →
  `Bearer` (`:574`) → `GET /auth/v1/user`. `user_id` dari body diabaikan; `api/feature-credits.js:244`
  memakai `p_user_id: user.id` hasil verifikasi (bukan `body.user_id`).
- `apikey` hanya identitas project/gateway; service-role JWT di client ditolak
  (`assets/js/config.js:176,327`).
- Client **tidak pernah** menulis `profiles.credits` — semua `supabase.from("profiles")` di client
  hanya `.select(...)`; `admin-control/topup/topup-approval.js:219` mencatat "tidak ada lagi UPDATE
  profiles dari browser".
- Pemotongan kredit dilakukan server sebelum task dikirim: `api/generate.js:1362`
  (`deduct_generate_credits`) → gagal = HTTP 402, tidak ada generate. Refund: `:1468`.
- Fitur lain lewat `charge_feature_credits` / `settle_feature_credits`
  (`api/feature-credits.js:252,276`, `api/openkey-chat.js:2512,2577`).
- Admin: `api/admin-credit.js:158` (`verifyAdmin`) memverifikasi JWT lalu mensyaratkan role
  `ADMIN`/`OWNER` + status `active`; penulisan tetap via service role (`:501`).
- GitHub Actions refund memakai `SUPABASE_SERVICE_KEY` (`.github/workflows/upscale.yml:367`,
  `upscale-photo.yml:381`).

Matriks kombinasi (tetap berlaku setelah perbaikan):

| Kombinasi | Hasil |
| --- | --- |
| `access_token` + `apikey anon` | Normal — identitas dari JWT, saldo user itu yang dipakai |
| `access_token` A + `refresh_token` A | Normal (perpanjang sesi user yang sama) |
| `access_token` A + `refresh_token` B | Sesi pindah ke **user B** → kredit B terpakai. Ini risiko **pencurian token**, bukan manipulasi saldo |
| Hanya `apikey anon` tanpa login | Generate ditolak 401 |
| `apikey anon` + RPC kredit | **Sekarang ditolak seluruhnya** |
| `service_role key` bocor | Satu-satunya jalur "kredit = 0" secara langsung — jaga & rotasi kunci ini |
| API key provider (KIE/OpenKey/dll.) | Tidak menyentuh kredit GEN-Z.AI; didekripsi di server, client tak bisa menyelipkan key sendiri |

Catatan: **refresh token rotation = ON**, reuse interval 60 detik (`get_auth_config`).

---

## 3. Temuan & status perbaikan

### F1 — KRITIS: `refund_generate_credits()` & `refund_credit()` bisa mencetak kredit tanpa login

ACL sebelum perbaikan:

```
refund_generate_credits(uuid,numeric)         =X/postgres | postgres | anon | authenticated | service_role
refund_credit(uuid,integer,text,uuid)         =X/postgres | postgres | anon | authenticated | service_role
refund_failed_generation_credits(uuid,text)   =X/postgres | postgres | anon | authenticated | service_role
```

`refund_generate_credits` (`supabase/feature-credit-history.sql:15`) adalah `SECURITY DEFINER`
tanpa `REVOKE`, sehingga:

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/refund_generate_credits" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id":"<uuid-sendiri>","p_amount":999999}'
```

`refund_credit(uuid,integer,text,uuid)` bahkan **tidak punya pemeriksaan otorisasi sama sekali**
di dalam body-nya; `p_user_id` bebas.

### F2 — KRITIS: `deduct_credit()` / `deduct_generate_credits()` bisa menguras saldo user lain sampai 0

Ini **jawaban langsung** untuk pertanyaan "kredit jadi 0". Kedua fungsi menerima `p_user_id`
sembarang dan **tidak** memverifikasi pemanggil:

```sql
-- deduct_credit: langsung potong saldo target, tanpa cek siapa pemanggilnya
select credits into old_balance from public.profiles where id = target_user_id for update;
new_balance := old_balance - credit_amount;
update public.profiles set credits = new_balance where id = target_user_id;
```

`deduct_generate_credits` sudah benar dari sisi logika (menolak `p_amount` negatif, atomik
`credits >= p_amount`), jadi tidak bisa dipakai menambah kredit — tapi ACL-nya terbuka sehingga
bisa dipanggil untuk **mengosongkan saldo akun mana pun**.

### F3 — TINGGI: `admin_cancel_generation()` & `admin_set_model_quota()` tanpa cek admin

Keduanya `SECURITY DEFINER`, **tanpa** pemeriksaan `auth.uid()`/role, dan terbuka untuk
anon/authenticated. Efek: siapa pun bisa membatalkan job (memicu refund) dan mengubah kuota model
(bisa me-reset `auto_disabled_at` / mengaktifkan model yang auto-disabled).

### F4 — SEDANG: statistik kredit & daftar user bocor ke semua akun

`sum_profile_credits()`, `count_profiles()`, `count_active_profiles()`,
`count_generation_history()`, `get_active_user_ids()` = `SECURITY DEFINER` tanpa guard.
`get_active_user_ids()` membocorkan **UUID user yang sedang generate**; `sum_profile_credits()`
membocorkan total kredit platform.

### F5 — SEDANG: kolom `credits` hanya dilindungi RLS

Policy `profiles` saat ini **hanya SELECT** (own + admin) sehingga tulis dari client sudah tertutup.
Namun grant kolom `UPDATE (credits)` untuk `anon`/`authenticated` **masih ada** — satu kesalahan
policy di masa depan langsung membuka semuanya.

### F6 — RENDAH (belum bisa diterapkan lewat connector, perlu dashboard)

Temuan dari `get_auth_config` + status penerapan:

| Setelan | Nilai | Status |
| --- | --- | --- |
| `audit_log_disable_postgres` | `true` | **Belum** — MCP Supabase tidak mengekspos field ini. Diganti audit trail kredit sendiri (§4a). Aktifkan manual di Dashboard untuk event auth. |
| `password_min_length` | `6` | **Belum** — field tidak diekspos connector. Catatan: client sudah mewajibkan 8 (`register.html:2076,2806`, `reset-password.html:1026,1830`), jadi menaikkan ke 8 tidak akan memutus alur. |
| `password_hibp_enabled` | `false` | **Belum** — field tidak diekspos connector |
| `security_update_password_require_reauthentication` | `false` | **Sengaja dibiarkan** — alur reset password memakai tautan email (`user/profile.html:1515`), mengaktifkan ini akan memutus reset |
| `jwt_exp` | `3600` (1 jam) | **SUDAH diubah** 2026-10-29 (dari `604800` = 7 hari → 24 jam → 1 jam). Lihat §7 |
| `refresh_token_rotation_enabled` | `true`, reuse 60 s | Sudah baik |
| `mailer_autoconfirm` | `false` | Sudah baik (email wajib diverifikasi) |
| `external_anonymous_users_enabled` | `true` | Dibiarkan — dipakai tamu live-chat (`assets/js/support-chat.js:354`); user baru dibuat dengan `credits = 0` (`handle_new_user`), jadi tidak bisa dipakai farming kredit |

Field yang bisa diubah connector: `disable_signup`, `external_email_enabled`,
`external_phone_enabled`, `jwt_exp`, `mailer_autoconfirm`,
`security_refresh_token_reuse_interval`, `security_refresh_token_rotation_enabled`,
`site_url`, `sms_autoconfirm`, `uri_allow_list`.

---

## 4. Perbaikan yang sudah diterapkan di database

File: `supabase/credit-rpc-hardening.sql` (idempotent, boleh dijalankan ulang).

1. **Kredit & mutasi sensitif → `service_role` saja** (revoke dari `PUBLIC`, `anon`, `authenticated`):
   `refund_generate_credits`, `deduct_generate_credits`, `refund_failed_generation_credits`,
   `deduct_credit`, `refund_credit`, `admin_cancel_generation`, `admin_set_model_quota`,
   `qwencloud_quota_reconcile_all`, `qwencloud_quota_reconcile`, `qwencloud_quota_recheck`.
   `charge_feature_credits` / `settle_feature_credits` sudah benar dan dipertahankan.
2. **Fungsi ber-guard admin → `authenticated` tetap, `anon`/`PUBLIC` dicabut**:
   `add_credit`, `admin_remove_credit`, `approve_topup`, `approve_topup_and_add_credits`,
   `admin_create_provider`, `admin_update_provider`, `admin_delete_provider`
   (semuanya sudah memeriksa role `ADMIN`/`OWNER` di dalam body; halaman admin memanggilnya
   dengan JWT admin).
3. **Statistik → guard `public.is_admin_or_owner()`** di dalam body + `anon` dicabut:
   `sum_profile_credits`, `count_profiles`, `count_active_profiles`, `count_generation_history`,
   `get_active_user_ids`.
4. **Trigger `guard_profile_credits`** pada `public.profiles`: menolak perubahan kolom `credits`
   bila `current_user in ('anon','authenticated')` → error `42501 CREDITS_READ_ONLY`.
   Lapis kedua kalau RLS/policy berubah di masa depan.
5. `notify pgrst, 'reload schema'` supaya PostgREST langsung memakai ACL baru.

### Verifikasi yang sudah dijalankan

```
set local role anon; select public.refund_generate_credits('00000000-...'::uuid, 1);
→ ERROR 42501: permission denied for function refund_generate_credits   ✅

set local role authenticated; update public.profiles set credits = 0 where id = ...;
→ 0 rows (RLS) — tidak ada perubahan saldo                              ✅

set local role service_role; select public.refund_generate_credits('00000000-...'::uuid, 1);
→ USER_PROFILE_NOT_FOUND (sampai ke badan fungsi = privilege OK)        ✅
```

ACL akhir: **semua** fungsi kredit di atas `anon_can = false`, `auth_can = false`,
`acl = {postgres=X/postgres,service_role=X/postgres}`.

### 4a. Audit trail kredit (pengganti audit log Postgres)

File: `supabase/credit-audit-log.sql` (sudah dijalankan, idempotent).

- Tabel `public.credit_change_audit`: satu baris setiap `profiles.credits` berubah —
  `old_credits`, `new_credits`, `delta`, role DB pemanggil (`db_user`), `auth_uid` dari JWT,
  `source`, `changed_at`. RLS aktif; hanya admin (`is_admin_or_owner()`) dan `service_role`
  yang bisa membaca; `anon`/`authenticated` dicabut.
- Trigger `guard_profile_credits_trg` (BEFORE, **SECURITY INVOKER**) + `log_credit_changes_trg`
  (AFTER, definer). Catatan penting: guard **wajib** INVOKER — pada fungsi `SECURITY DEFINER`,
  `current_user` berubah menjadi owner sehingga pengecekan `anon`/`authenticated` tidak pernah
  terpicu. Versi awal migration sempat salah dan sudah diperbaiki.
- Batasan yang diakui: percobaan tulis yang **ditolak** tidak menghasilkan baris audit karena
  statement tersebut ikut rollback (Postgres tanpa autonomous transaction). Yang tercatat adalah
  perubahan yang benar-benar diterapkan. Untuk mencatat percobaan gagal, aktifkan audit log
  Postgres di Dashboard.

Uji yang dijalankan:

```
-- service_role: tercatat
begin; set local role service_role;
update profiles set credits = credits + 1 where id = <uuid>;
reset role; select * from credit_change_audit order by id desc limit 1;
-- db_user = 'service_role', source = 'applied'
rollback;

-- authenticated dengan policy UPDATE longgar (skenario terburuk):
--   -> DIBLOKIR: CREDITS_READ_ONLY | sqlstate=42501
```

---

## 5. Yang perlu dipantau / dikerjakan berikutnya

1. **Dashboard Supabase** (tidak bisa lewat connector): aktifkan
   `audit_log_disable_postgres = false`, `password_min_length = 8`, `password_hibp_enabled = true`
   di Project Settings → Authentication.
2. **`topup_requests`**: user boleh `INSERT` request sendiri (`status` wajib `pending`,
   `user_id = auth.uid()`), tapi **nominal `credits` diisi sendiri oleh user**. Approval tetap
   butuh admin (`approve_topup` ber-guard), namun idealnya nominal dihitung server dari paket harga.
3. **Rotasi `SUPABASE_SERVICE_ROLE_KEY`** bila pernah terekspos — key ini melewati semua proteksi.
4. **Monitoring rutin** pakai audit baru:

   ```sql
   -- perubahan kredit besar 24 jam terakhir
   select * from public.credit_change_audit
    where changed_at > now() - interval '24 hours' and abs(delta) >= 1000
    order by changed_at desc;

   -- perubahan dari role yang bukan server
   select * from public.credit_change_audit
    where db_user not in ('service_role','postgres')
    order by changed_at desc;
   ```
5. Jalankan ulang verifikasi §4 setiap kali ada migration yang menambah fungsi `SECURITY DEFINER`.
6. `jwt_exp` 7 hari → bisa dipersingkat (mis. 1 jam); client sudah auto-refresh dengan buffer 5 menit
   (`assets/js/auth.js:76`, `navigation/navigation.js:62`, `generate/assets/js/generate-auth.js:45`).

---

## 6. Bukti tidak ditemukan eksploitasi (per 2026-10-29)

```
credit_transactions 60 hari terakhir : admin_add 2× (+100), admin_remove 2× (−100)
                                       → tidak ada baris 'generation'/'refund' dari fungsi terbuka
profiles                             : 7 akun, total kredit 1.051.936
                                       (1 akun 1.050.936 — saldo owner, mohon dicek manual)
generation_history 60 hari           : 325 baris, 111 di antaranya refunded (158.792,5 kredit)
```

`deduct_credit()` mencatat transaksi bertipe `generation` dan `refund_credit()` bertipe `refund`;
tidak ada baris seperti itu, jadi kedua jalur tersebut **tidak pernah dipakai** untuk
mengeksploitasi. Catatan: `deduct_generate_credits` (dipakai normal) menulis ke `generation_history`,
jadi pemakaian wajar tetap terlihat di sana.

Tetap disarankan memeriksa manual akun dengan saldo 1.050.936 dan 111 refund tersebut, karena
sebelum perbaikan ini tidak ada log yang bisa membedakan pemakaian sah dan tidak.

---

## 7. Perubahan `jwt_exp` (2026-10-29)

**Sebelum:** `604800` detik = 7 hari → **24 jam** (`86400`) → **akhirnya 1 jam** (`3600`).

Diterapkan lewat `update_auth_config` (field ini termasuk yang diekspos connector Supabase),
diverifikasi ulang dengan `get_auth_config`: `jwt_exp: 3600`, setelan lain utuh
(`rate_limit_token_refresh: 150`, `rate_limit_email_sent: 2`,
`security_captcha_provider: hcaptcha`, `sessions_*: 0`,
`refresh_token_rotation_enabled: true`, `security_refresh_token_reuse_interval: 60`).

### Ini BUKAN auto-logout

`jwt_exp` hanya umur **access token** (tiket per-request). Sesi login ditentukan
**refresh token**, yang tidak ikut kedaluwarsa selama dipakai. Konsekuensinya user
tidak perlu login ulang tiap jam; token lama ditukar otomatis sebelum habis.

### Mekanisme refresh di aplikasi (sudah diverifikasi)

| Lokasi | Mekanisme |
| --- | --- |
| `navigation/navigation.js:63,1230` | keep-alive tiap **4 menit** memanggil `ensureFreshToken()` (non-force) |
| `navigation/navigation.js:1237-1260` | refresh saat tab kembali aktif, window fokus, jaringan online, `storage` event lintas tab |
| `navigation/navigation.js:557-561` | rotasi refresh token hanya bila sisa umur < `TOKEN_REFRESH_BUFFER_SEC = 300` detik; selain itu hanya sinkronisasi sesi ke memori |
| `assets/js/auth.js:238-330` | `ensureFreshStoredSession()`, buffer 300 detik, baca `expires_at`/`expires_in` (tidak pernah hardcode umur token) |
| `generate/assets/js/generate-auth.js:1163-1178` | `getAccessToken()` selalu `ensureFreshToken()` dulu → semua request generate & polling status memakai token segar |
| `topup/payment/index.html:1015` | memakai `supabase.createClient` (autoRefreshToken bawaan supabase-js) |
| `assets/js/auth.js:294-300` | storage baru dibersihkan (→ login) hanya bila endpoint refresh menjawab 400/401/403 (refresh token benar-benar tidak valid) |

Dengan token 1 jam, rotasi terjadi ≈ **1×/jam per tab** (bukan tiap 4 menit), jauh di bawah
`rate_limit_token_refresh = 150`/jam. Reuse interval 60 detik menutup race antar-tab saat rotasi.

### Yang perlu dipantau

- **Server yang clock-nya melenceng** bisa memicu 401 lebih sering; pantau log 401 di Worker.
- **Tab yang lama di-background** (browser membekukan timer) akan me-refresh saat kembali aktif —
  jalur ini sudah ditangani listener `visibilitychange`/`focus`.
- **Task panjang** (video > 1 jam) aman: polling status memanggil `getAccessToken()` setiap kali,
  dan token diverifikasi di awal tiap request (`api/generate.js:499`).
- Bila muncul keluhan login mendadak, naikkan kembali ke `86400` lewat `update_auth_config`
  (satu field, instan, tanpa deploy).

### Sesi tetap tidak dibatasi waktu

`sessions_timebox: 0` dan `sessions_inactivity_timeout: 0` → sesi bisa bertahan berbulan-bulan
selama refresh token dipakai. Kalau ingin ada logout otomatis (mis. 30 hari), itu setelan
terpisah di Dashboard, bukan `jwt_exp`.
