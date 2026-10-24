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
