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
   POST /api/email?name=<provider>
   GET  /api/email/{email}/messages?token=..&name=..
   GET  /api/email/{email}/message/{id}?token=..&name=..
```

Provider bawaan adalah **gmail** (alias `user+tag@gmail.com` lewat IMAP).
Bila provider itu sedang down/disabled, Worker otomatis mencoba
`TEMPMAIL_PROVIDER` berikutnya lalu fallback `auto` (provider sehat lain
menurut prioritas Tempmail-MCP, mis. `mail.tm`).

---

## 2. Prasyarat

1. **Tempmail-MCP sudah berjalan** (lihat repo-nya: `sugionoofficial/Tempmail-MCP`).
   Untuk provider gmail, server tersebut wajib punya:
   ```env
   GMAIL_EMAIL=akun@gmail.com
   GMAIL_APP_PASSWORD=app-password-16-digit
   ```
   Cek kesehatan provider dari server TempMail:
   ```bash
   curl -s https://<host-tempmail>/api/health
   curl -s https://<host-tempmail>/api/providers
   ```
2. **Tabel database** sudah dibuat — jalankan
   [`supabase/tempmail-user-aliases.sql`](supabase/tempmail-user-aliases.sql)
   di Supabase SQL Editor. Tabel ini RLS-aktif dan hanya bisa diakses
   `service_role` (dipakai Worker), bukan dari browser.
3. **Secret Cloudflare Worker** (Settings → Variables and Secrets):

   | Nama | Wajib | Contoh |
   |---|---|---|
   | `TEMPMAIL_API_URL` | ya | `https://tempmail.example.com` |
   | `TEMPMAIL_PROVIDER` | tidak | `gmail` (default) atau `gmail,mail.tm` |

   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`
   harus sudah terpasang karena endpoint ini memakainya untuk verifikasi
   session dan penyimpanan alias.

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

## 5. Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
|---|---|---|
| `TEMPMAIL_API_URL belum di-set` | Secret belum dibuat di Worker | Tambahkan `TEMPMAIL_API_URL`, lalu redeploy |
| `Konfigurasi database TempMail belum lengkap` | `SUPABASE_SERVICE_ROLE_KEY` kosong | Isi secret tersebut |
| `Konfigurasi autentikasi Supabase belum lengkap` | `SUPABASE_ANON_KEY` kosong | Isi secret tersebut |
| `Session tidak valid atau sudah kedaluwarsa` | Access token kedaluwarsa / project Supabase berbeda | Login ulang; pastikan `SUPABASE_URL` Worker = project di `assets/js/config.js` |
| `Fitur TempMail hanya tersedia untuk role admin atau owner` | Role di `profiles` bukan admin/owner (nilai `Administrator` otomatis dianggap `admin`) | Ubah role user di admin panel |
| `Gagal membuat email TempMail. ... Provider gagal` | Tempmail-MCP down / gmail IMAP gagal login | Cek `/api/health` dan `/api/providers`; perbaiki `GMAIL_APP_PASSWORD` |
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
