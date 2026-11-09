# TempMail — Setup & Troubleshooting

Menu **TempMail** (`/email.html`) membuat alamat `@gmail.com` sementara
untuk verifikasi/test akun. Fitur ini **khusus role `admin` dan `owner`**,
dan setiap user hanya bisa melihat alias miliknya sendiri.

---

## 1. Arsitektur singkat

```
Browser (email.html)
   │  Authorization: Bearer <Supabase access token>
   ▼
Cloudflare Worker  /api/tempmail        (functions/_shared/tempmail-handler.js)
   │  1. verifikasi JWT ke Supabase Auth
   │  2. cek role di tabel public.profiles (admin/owner)
   │  3. baca/simpan alias di public.tempmail_user_aliases
   ▼
Tempmail-MCP (self-hosted, TEMPMAIL_API_URL)
   https://github.com/sugionoofficial/Tempmail-MCP  <-- source, BUKAN host API
   POST /api/email?name=<provider>
   GET  /api/email/{email}/messages?token=..&name=..
   GET  /api/email/{email}/message/{id}?token=..&name=..
```

Provider bawaan adalah **gmail** (alias `user+tag@gmail.com` lewat IMAP).
Bila provider itu sedang down/disabled, Worker otomatis mencoba
`TEMPMAIL_PROVIDER` berikutnya lalu fallback `auto` (provider sehat lain
menurut prioritas Tempmail-MCP, mis. `mail.tm`).

---

## 2. Dua mode provider

### Mode A — Opsional, bukan untuk `@gmail.com`

⚠️ **Mode ini TIDAK menghasilkan `@gmail.com`.** Pakai hanya bila domain
Gmail tidak wajib. Aktifkan eksplisit dengan `TEMPMAIL_PROVIDER=mailtm`;
tanpa itu, secret `TEMPMAIL_API_URL` yang kosong tetap dianggap
konfigurasi belum lengkap supaya admin tidak diam-diam mendapat alamat
non-Gmail.

Saat diaktifkan, **tidak perlu `TEMPMAIL_API_URL`, tidak perlu
Tempmail-MCP, tidak perlu membuka GitHub Codespace.** Worker `genzai`
langsung memanggil REST API
`https://api.mail.tm` secara server-side [1](https://docs.mail.tm/):

1. `GET /domains` → pilih domain aktif.
2. `POST /accounts` + `POST /token` → buat mailbox dan token.
3. `GET /messages?page=1` / `GET /messages/{id}` → baca inbox.

Kredensial (`token` + `password`) disimpan sebagai JSON di kolom
`tempmail_user_aliases.token`, hanya bisa dibaca Worker lewat
`service_role`; browser tidak pernah menerimanya. Gate role admin/owner dan
isolasi alias per user tetap berlaku.

Konsekuensi: alamat yang dibuat **bukan `@gmail.com`**, melainkan
`xxxx@<domain-aktif-mail.tm>`. Untuk verifikasi OTP / kode, ini tetap bisa
dipakai. Bila Anda memang butuh `@gmail.com`, pakai Mode B.

Yang wajib diset di Cloudflare hanyalah secret Supabase yang sudah ada:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Tabel
`public.tempmail_user_aliases` juga tetap wajib (lihat
[`supabase/tempmail-user-aliases.sql`](supabase/tempmail-user-aliases.sql)).

`action=diagnostics` dalam mode ini memeriksa `builtin_mailtm` lewat
`GET https://api.mail.tm/domains`, bukan `/api/health` Tempmail-MCP.

### Mode B — Wajib untuk `@gmail.com` (tanpa Codespace)

Isi secret `TEMPMAIL_API_URL` dengan URL dasar instance FastAPI yang
**persisten** (VPS / Cloudflare Tunnel / Render / Railway), bukan URL repo
GitHub dan bukan port-forward `*.app.github.dev` Codespaces. Lihat
[docs/tempmail-setup.md](docs/tempmail-setup.md#host-github-codespaces-appgithubdev).

Artefak siap pakai ada di
[`deploy/tempmail-mcp/`](deploy/tempmail-mcp/README.md): `setup.sh` clone
repo upstream, menulis `.env` mode `600`, menjalankan `docker compose`
(FastAPI + FlareSolverr + Caddy HTTPS), lalu mencetak perintah
`wrangler secret put TEMPMAIL_API_URL`. Jalankan sekali di VPS; setelah itu
tidak ada Codespace yang perlu dibuka.

| Nama | Wajib | Contoh |
|---|---|---|
| `TEMPMAIL_API_URL` | ya, khusus Mode B | `https://tempmail.example.com` |
| `TEMPMAIL_PROVIDER` | tidak | `gmail` / `gmail,mail.tm` / `mailtm` |

`TEMPMAIL_PROVIDER=mailtm` memaksa Mode A walaupun secret Mode B terisi.
Untuk provider Gmail, server Tempmail-MCP wajib punya `GMAIL_EMAIL` dan
`GMAIL_APP_PASSWORD` (jangan commit nilainya ke repo).

---

## 3. Endpoint `/api/tempmail`

Semua action wajib membawa `Authorization: Bearer <access_token>` milik
user admin/owner. Respons selalu `Cache-Control: no-store`.

| Method | Action | Parameter | Fungsi |
|---|---|---|---|
| `GET` | `alias` | — | Ambil alias tersimpan (tanpa membuat baru) |
| `POST` | `create` | — | Pakai alias yang ada, atau buat baru |
| `GET` | `messages` | `email` | Daftar pesan pada alias |
| `GET` | `message` | `email`, `messageId` | Isi lengkap satu pesan |

Contoh:

```bash
curl -s "$BASE/api/tempmail?action=alias" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Respons sukses `create`:

```json
{
  "email": "akun+abcdefghij@gmail.com",
  "provider": "gmail",
  "createdAt": "2026-11-08T10:00:00.000Z",
  "reused": true
}
```

`messages` dinormalisasi menjadi:

```json
[
  {
    "id": "4821",
    "subject": "Your verification code",
    "from": "GitHub <noreply@github.com>",
    "to": "akun+abcdefghij@gmail.com",
    "preview": "Kode: 482913",
    "createdAt": "1762000000"
  }
]
```

---

## 4. Perilaku halaman `/email.html`

- Saat dibuka, halaman memanggil `action=alias` sehingga **alamat email
  tidak hilang setelah reload** (dulu harus klik "Generate" lagi).
- Tombol **Buat Email** memakai ulang alias yang sudah ada; alamat baru
  hanya dibuat bila user belum punya alias.
- Inbox diperbarui otomatis tiap 15 detik (berhenti saat tab tidak aktif)
  dan bisa di-refresh manual.
- Token Supabase disegarkan lewat `window.GENZSession.ensureFreshSession()`
  sebelum request; bila server tetap membalas 401, request diulang sekali.
- **Isi email dirender di iframe `sandbox=""`** dengan CSP ketat
  (`default-src 'none'`). HTML dari pengirim luar tidak pernah dieksekusi
  di origin aplikasi, sehingga tidak bisa mencuri session di `localStorage`.
  Subject/pengirim di daftar inbox dirender dengan `textContent`, bukan
  `innerHTML`.

---

## 4a. Cek konfigurasi dari browser (`diagnostics`)

Klik **🔍 Cek Konfigurasi** di `/email.html` (atau panggil
`GET /api/tempmail?action=diagnostics` sebagai admin/owner). Responsnya
berisi boolean konfigurasi (tanpa nilai secret), hasil
`/rest/v1/profiles`, `/rest/v1/tempmail_user_aliases`, dan probe read-only
ke server Tempmail-MCP: `GET /api/health`, `GET /api/providers`, dan
`GET /openapi.json`. Tiap probe dilaporkan (`endpoints`: path, status,
JSON/non-JSON), plus `capabilities` yang menunjukkan route inti yang
tersedia. Action `status` adalah alias untuk `action=alias`.

`/api/providers` **opsional**: bila endpoint itu 404 tetapi `/api/health`
atau `/openapi.json` merespons JSON, diagnostik tetap `ok` dan fitur
Buat Email/Inbox bisa dipakai. Yang dianggap rusak hanyalah: secret kosong,
`TEMPMAIL_API_URL` menunjuk ke domain aplikasi sendiri (self-reference,
termasuk lewat `META_REDIRECT_URI`), atau semua probe membalas non-JSON/404.
Untuk kasus terakhir hasilnya memuat `Content-Type` + cuplikan body 404,
`steps` langkah perbaikan, dan tombol **📋 Salin perintah cek** untuk
`curl -i <host>/api/health`.

Lihat juga [`docs/tempmail-setup.md`](docs/tempmail-setup.md) untuk peta
error → tindakan.

---

## 5. Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
|---|---|---|
| `TEMPMAIL_API_URL belum di-set` | Hanya muncul bila Mode B dipaksa; Mode A tidak membutuhkannya | Biarkan kosong untuk memakai built-in `mail.tm`, atau isi URL Tempmail-MCP persisten lalu redeploy |
| `Gagal membaca pemetaan alias TempMail (HTTP 404). ... PGRST205` | Tabel belum ada / schema cache PostgREST basi | Jalankan `supabase/tempmail-user-aliases.sql` (sudah ada `pg_notify('pgrst', 'reload schema')`) |
| `Konfigurasi database TempMail belum lengkap` | `SUPABASE_SERVICE_ROLE_KEY` kosong | Isi secret tersebut |
| `Konfigurasi autentikasi Supabase belum lengkap` | `SUPABASE_ANON_KEY` kosong | Isi secret tersebut |
| `Session tidak valid atau sudah kedaluwarsa` | Access token kedaluwarsa / project Supabase berbeda | Login ulang; pastikan `SUPABASE_URL` Worker = project di `assets/js/config.js` |
| Diagnostik: `❌ tempmail_provider · HTTP 404` + `Endpoint /api/providers tidak membalas JSON` | `/api/providers` tidak ada di deployment (versi lama / proxy hanya meneruskan `/api/email`) | **Bukan kerusakan** bila `/api/health` atau `/openapi.json` hidup: diagnostik baru memprobe 3 endpoint dan tidak lagi menggagalkan config hanya karena satu endpoint opsional 404. Lihat [docs/tempmail-setup.md](docs/tempmail-setup.md#kenapa-apiproviders-bisa-404) |
| Diagnostik: ketiga probe `404 (non-JSON)` + `endpoint inti=false` | `TEMPMAIL_API_URL` bukan host API yang aktif (service mati / domain salah / diisi domain aplikasi) | Cek cuplikan body 404 di hasil diagnostik, jalankan perintah `curl -i` yang bisa disalin, deploy ulang Tempmail-MCP lalu `npx wrangler@4 secret put TEMPMAIL_API_URL`. Lihat [docs/tempmail-setup.md](docs/tempmail-setup.md#semua-probe-404-non-json) |
| Diagnostik: `TEMPMAIL_API_URL berisi URL repositori kode` | Secret diisi URL GitHub `https://github.com/sugionoofficial/Tempmail-MCP`, bukan URL server FastAPI yang berjalan | Deploy repo itu (`docker compose up -d`), expose ke HTTPS publik, lalu isi secret dengan URL host-nya. Lihat [docs/tempmail-setup.md](docs/tempmail-setup.md#repo-sumber-bukan-host-api) |
| Diagnostik: host `*.app.github.dev` / `*.githubpreview.dev` | `TEMPMAIL_API_URL` memakai port-forward GitHub Codespaces (ephemeral, port privat, Codespace stop) | Cek `localhost:8000/api/health`, set port **Public**, atau pindah ke host persisten lalu set ulang secret. Lihat [docs/tempmail-setup.md](docs/tempmail-setup.md#host-github-codespaces-appgithubdev) |
| `Fitur TempMail hanya tersedia untuk role admin atau owner` | Role di `profiles` bukan admin/owner (nilai `Administrator` otomatis dianggap `admin`) | Ubah role user di admin panel |
| `Gagal membuat email TempMail. ... Provider gagal` | Mode B: Tempmail-MCP down / gmail IMAP gagal login. Mode A: `api.mail.tm` sedang rate-limit / domain kosong | Mode B: cek `/api/health` dan `/api/providers`, perbaiki `GMAIL_APP_PASSWORD`. Mode A: cek `curl -i https://api.mail.tm/domains`, tunggu sebentar lalu klik **Buat Email** lagi |
| Halaman hanya menampilkan "Akses terbatas" padahal admin | `navigation.js` gagal dimuat / cache lama | Hard refresh (Ctrl+Shift+R), pastikan `/navigation/navigation.js` tidak 404 |
| Email baru selalu berbeda padahal belum klik "Buat Email" | Ada baris ganda di `tempmail_user_aliases` | `user_id` adalah primary key, jadi tidak mungkin ganda; periksa user sedang login dengan akun yang benar |
| Pesan masuk tidak muncul padahal sudah dikirim | Provider gmail memfilter `To:` — pastikan pengirim mengirim ke alamat **+tag** lengkap | Copy ulang alamat email dari halaman TempMail |

---

## 6. Catatan keamanan

- Pemeriksaan role dilakukan **di server** pada setiap request, bukan hanya
  guard UI di halaman.
- Alias selalu difilter `user_id = <user JWT>`; user lain (termasuk admin
  lain) mendapat `404` bila menebak alamat email orang lain.
- Email hasil generate yang kebetulan bentrok dengan alias user lain
  diulang otomatis (maksimal 3 kali per provider).
- Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY` atau kredensial Gmail di
  frontend. Hanya Worker yang memegang kunci tersebut.

---

## Ringkasan perubahan mode bawaan

- `functions/_shared/mailtm-provider.js` berisi klien `mail.tm` (tanpa
  kredensial yang dikirim ke browser).
- `functions/_shared/tempmail-handler.js` memakai `mailtm` HANYA bila
  `TEMPMAIL_PROVIDER=mailtm`; tanpa secret dan tanpa flag itu, `@gmail.com`
  tetap dijaga lewat Mode B dengan pesan konfigurasi yang jelas.
- `/email.html` tidak berubah alurnya: `alias`, `create`, `messages`,
  `message`, auto-refresh, iframe `sandbox=""`, dan tombol diagnostik tetap
  sama.
- Mode B tetap tersedia tanpa mengubah kontrak Tempmail-MCP lama.
- [`deploy/tempmail-mcp/`](deploy/tempmail-mcp/README.md) menyiapkan host
  persisten + HTTPS untuk Mode B, lengkap dengan `.gitignore` agar `.env`
  dan hasil clone upstream tidak pernah masuk repo.
