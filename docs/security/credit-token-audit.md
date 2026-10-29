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

### F6 — RENDAH (rekomendasi, belum diubah karena berdampak ke UX/auth)

Dari `get_auth_config`:

| Setelan | Nilai sekarang | Rekomendasi |
| --- | --- | --- |
| `audit_log_disable_postgres` | `true` | **Aktifkan** — tanpa audit log, investigasi kredit/refund sangat terbatas |
| `password_min_length` | `6` | Naikkan ke ≥ 8 |
| `password_hibp_enabled` | `false` | Aktifkan |
| `security_update_password_require_reauthentication` | `false` | Aktifkan (sesi dicuri bisa ganti password) |
| `sessions_inactivity_timeout` / `sessions_timebox` | `0` / `0` | Pertimbangkan batas inaktif |
| `jwt_exp` | `604800` (7 hari) | Pertimbangkan 1 jam + refresh rotation (rotation sudah ON) |
| `external_anonymous_users_enabled` | `true` | **Dibiarkan** — dipakai tamu live-chat (`assets/js/support-chat.js:354`), dan user baru dibuat dengan `credits = 0` (`handle_new_user`), jadi tidak bisa farming kredit |

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

---

## 5. Yang perlu dipantau / dikerjakan berikutnya

1. **`topup_requests`**: user boleh `INSERT` request sendiri (`status` wajib `pending`, `user_id` =
   `auth.uid()`), tapi **jumlah `credits` diisi sendiri oleh user**. Approval tetap butuh admin
   (`approve_topup` ber-guard), namun pastikan admin memverifikasi bukti bayar vs nominal —
   idealnya nominal dihitung server dari paket harga, bukan dari input user.
2. **Audit log database** masih OFF (F6) — aktifkan agar setiap perubahan kredit terekam.
3. **Rotasi `SUPABASE_SERVICE_ROLE_KEY`** bila pernah terekspos (key ini bypass semua proteksi di atas).
4. Jalankan ulang verifikasi §4 setiap kali ada migration baru yang menambah fungsi `SECURITY DEFINER`.

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
