# TempMail — konfigurasi & troubleshooting

Menu **TempMail** ada di `navigation/navigation.js` (`{ label: "TempMail", href: "/email.html" }`)
dan hanya dirender untuk role `admin` / `owner`. Halamannya `email.html`, sudah
termasuk dalam `staticFiles` pada `scripts/build-cloudflare-pages.mjs`, jadi tautan
navigasi tidak perlu diubah.

Alur singkat:

```
email.html (Bearer token Supabase)
  → /api/tempmail  (functions/_shared/tempmail-handler.js, via functions/worker.mjs)
  → Supabase Auth /auth/v1/user
  → public.profiles (role admin/owner)
  → public.tempmail_user_aliases (satu alias per user, service_role)
  → TEMPMAIL_API_URL (server TempMail-MCP)
```

## 1. Secret/variabel Worker (Cloudflare)

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SUPABASE_URL` | ya | `https://<ref>.supabase.co`, **harus project yang sama** dengan `assets/js/config.js` |
| `SUPABASE_ANON_KEY` | ya | publishable/anon key untuk verifikasi `/auth/v1/user` |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | dipakai untuk `profiles` dan `tempmail_user_aliases` (RLS ketat) |
| `TEMPMAIL_API_URL` | ya untuk fitur ini | URL **API** TempMail-MCP, bukan halaman UI/domain aplikasi utama |
| `TEMPMAIL_PROVIDER` | tidak | default `gmail`; set `auto` untuk selalu memakai provider sehat pertama |
| `TEMPMAIL_TIMEOUT_MS`, `TEMPMAIL_SUPABASE_TIMEOUT_MS` | tidak | override timeout (ms) untuk debugging |

Untuk lokal: salin `.dev.vars.example` menjadi `.dev.vars` dan isi
`TEMPMAIL_API_URL`. `npm run dev` kini juga memperingatkan bila variabel ini kosong.
`.dev.vars` sudah masuk `.gitignore`.

Catatan: `wrangler deploy` dari GitHub Actions tidak menulis secret. Set secret
sekali lewat `npx wrangler@4 secret put TEMPMAIL_API_URL` (atau dashboard
Cloudflare → Workers → Settings → Variables and Secrets).

## 2. Database Supabase

Jalankan `supabase/tempmail-user-aliases.sql` (sudah terdaftar sebagai migrasi
`tempmail_user_aliases`). Isinya:

- tabel `public.tempmail_user_aliases` (`user_id` PK → `auth.users`, `email` unik,
  `token`, `provider`, `created_at`);
- RLS aktif, grant hanya untuk `service_role`;
- `pg_notify('pgrst', 'reload schema')` agar PostgREST langsung mengenali tabel.

Gejala bila tahap ini bermasalah: error `Supabase REST (tempmail_user_aliases)
menolak permintaan (HTTP 404)` dengan `PGRST205` dan hint menjalankan SQL di atas.

## 3. Provider TempMail-MCP

Endpoint yang dipakai Worker:

| Method | Path |
| --- | --- |
| `POST` | `/api/email?name=<provider>` (body `{ min_name_length: 10, max_name_length: 10 }`) |
| `GET` | `/api/email/{email}/messages?token=…&name=…` |
| `GET` | `/api/email/{email}/message/{id}?token=…&name=…` |
| `GET` | `/api/providers` (diagnostik) |

Balasan `POST /api/email` wajib `{ email, token, provider }`. Nama provider
disimpan di database dan dipakai lagi saat membaca inbox.

Provider `gmail` di server TempMail-MCP butuh `GMAIL_EMAIL` +
`GMAIL_APP_PASSWORD`; startup health-check akan menonaktifkan provider yang gagal.
Karena itu Worker:

1. mencoba provider prioritas (`TEMPMAIL_PROVIDER`, default `gmail`);
2. bila server membalas **404/503** (provider tidak terdaftar / gagal), mengulang
   tanpa `name` sehingga TempMail-MCP memakai fallback `auto`;
3. menyimpan `provider` yang benar-benar dikembalikan server.

Jika semua provider nonaktif: `POST /api/providers/{name}/enable` pada server
TempMail-MCP, atau set `TEMPMAIL_PROVIDER=auto`.

## 4. Cara cek dari browser

Buka `/email.html` sebagai admin/owner → klik **🔍 Cek Konfigurasi**.
Tombol itu memanggil `GET /api/tempmail?action=diagnostics` dan menampilkan:

- keberadaan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `TEMPMAIL_API_URL` (boolean + host, **tanpa nilai secret**);
- hasil `GET /rest/v1/profiles` dan `GET /rest/v1/tempmail_user_aliases`;
- hasil `GET /api/providers`, termasuk provider yang sedang nonaktif.

Aksi lain: `GET /api/tempmail?action=status` mengembalikan alias yang tersimpan
tanpa membuat email baru (dipakai halaman untuk memulihkan inbox setelah refresh).

## 5. Pesan error yang sering muncul

| Pesan | Penyebab | Tindakan |
| --- | --- | --- |
| `TEMPMAIL_API_URL belum di-set di Cloudflare Worker.` | secret kosong | isi secret / `.dev.vars` |
| `Provider TempMail … membalas bukan JSON (HTTP 502, text/html)` | URL mengarah ke halaman HTML/proxy yang down | perbaiki `TEMPMAIL_API_URL` ke host API |
| `Provider TempMail (gmail) menolak pembuatan email (HTTP 503)` | provider gmail gagal IMAP / auto-disabled | cek kredensial Gmail di server atau `TEMPMAIL_PROVIDER=auto` |
| `Supabase REST (tempmail_user_aliases) … PGRST205` | tabel belum ada / schema cache basi | jalankan SQL + reload schema |
| `SUPABASE_SERVICE_ROLE_KEY ditolak` (401/403) | kunci lama / salah project | ganti secret kunci |
| `Provider … tidak merespons dalam 15000 ms` | server cold start / mati | cek host, naikkan `TEMPMAIL_TIMEOUT_MS` |
| `Session tidak valid atau sudah kedaluwarsa` | token browser vs project Worker beda | samakan `assets/js/config.js` dengan `SUPABASE_URL` Worker |

Error lama `Gagal memproses TempMail. Periksa konfigurasi Supabase dan provider.`
adalah catch generik yang menyembunyikan penyebab asli. Sekarang hanya muncul
untuk kesalahan tak terduga; kesalahan jaringan/HTTP/JSON selalu membawa pesan
spesifik, `detail` yang sudah disamarkan, dan `hint`.
