# TempMail — Hubungkan Gmail langsung dari `/email.html`

Mode ini menjawab alur yang paling sederhana:

> login ke GEN-Z.AI → buka menu **TempMail** → klik **Hubungkan Gmail** sekali →
> ketik akhiran mis. `1` → klik **Generate ujung** → dapat
> `sugionoofficial88+1@gmail.com` → pesan masuk muncul di halaman yang sama.

**Tanpa Docker**, Docker Desktop, BIOS/virtualisasi, WSL2, VPS, Caddy,
Cloudflare Tunnel, GitHub Codespace, port-forward `*.app.github.dev`, atau
server Tempmail-MCP. Yang berjalan hanyalah Cloudflare Worker `genzai`,
Supabase, dan Gmail REST API.

> Catatan: contoh `sugionnoofficial88+1@gamil.com` pada pertanyaan awal
> memiliki typo domain. Sistem **selalu** memakai `@gmail.com` dan menolak
> akun bukan `@gmail.com`; plus-addressing tidak bisa membuat domain baru.

---

## 1. Apa yang sudah ada di kode

| Bagian | File | Fungsi |
|---|---|---|
| Panel koneksi + generator akhiran | `email.html` | Tombol Hubungkan Gmail, input `+tag`, Generate ujung, inbox |
| Endpoint `/api/tempmail` | `functions/_shared/tempmail-handler.js` | `gmail-status`, `gmail-connect`, `gmail-disconnect`, `rotate`, `create`, `messages`, `message`, `diagnostics` |
| OAuth + Gmail API + enkripsi | `functions/_shared/gmail-provider.js` | Google OAuth2, refresh token AES-256-GCM, `users.messages.list/get` |
| Callback Google | `functions/worker.mjs` → `/api/tempmail-gmail-callback` | Terima `code`, tukar token, simpan koneksi, redirect ke `/email.html?gmail=connected` |
| Tabel kredensial | `supabase/tempmail-gmail-connections.sql` | `user_id`, `email`, ciphertext, IV; RLS + `service_role` only |
| Tema cerah panel baru | `assets/css/tempmail-light.css` | Input dan panel tetap terbaca di light mode |

Mode C otomatis aktif bila **ketiga** secret berikut tersedia di Worker:
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, dan
`PROVIDER_CREDENTIAL_ENCRYPTION_KEY`. Kunci enkripsi boleh 64 hex, base64 32
byte, atau secret teks panjang (diturunkan SHA-256), mengikuti pola vault
kredensial yang sudah ada di repo. Bila ketiganya belum ada, Mode B lama
(`TEMPMAIL_API_URL`) dan Mode A (`TEMPMAIL_PROVIDER=mailtm`) tetap berlaku.
Artefak `deploy/tempmail-mcp/` **tidak dihapus** dan tidak perlu dipakai
untuk Mode C.

---

## 2. Sekali setup di Google Cloud

1. Buka <https://console.cloud.google.com/> lalu buat/pilih satu project.
2. **APIs & Services → Library → Gmail API → Enable**.
3. **Google Auth Platform / OAuth consent screen**:
   - User Type: `External` (atau `Internal` bila akun termasuk Google Workspace organisasi).
   - Isi nama aplikasi, email support, dan email developer.
   - Tambahkan akun Gmail Anda, mis. `sugionoofficial88@gmail.com`, sebagai **Test user** bila status masih `Testing`.
   - **Data Access / Scopes**: tambahkan scope
     `https://www.googleapis.com/auth/gmail.readonly`.
   - Scope ini termasuk kategori sensitive/restricted. Untuk pemakaian pribadi,
     status `In production` yang belum diverifikasi masih bisa dipakai dengan
     peringatan "unverified app". Bila consent screen dibiarkan `Testing`,
     refresh token Google kedaluwarsa dalam 7 hari dan harus dihubungkan ulang
     [1](https://developers.google.com/identity/protocols/oauth2#expiration).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**, bukan Desktop app.
   - **Authorized redirect URIs** tambahkan URL callback Worker/Pages:
     `https://<domain-aplikasi>/api/tempmail-gmail-callback`.
   - Bila aplikasi diakses lewat lebih dari satu origin (mis. domain custom
     dan `*.workers.dev`), daftarkan keduanya.
   - Untuk `wrangler dev` lokal, daftarkan juga
     `http://127.0.0.1:8787/api/tempmail-gmail-callback` bila Google
     menerimanya untuk client Web.
5. Salin **Client ID** dan **Client secret**.

`GMAIL_OAUTH_REDIRECT_URI` bersifat opsional. Kosongkan bila callback
dihitung otomatis dari origin halaman. Isi secret ini bila origin di balik
proxy berbeda atau Anda memakai satu redirect URI tetap:

```powershell
npx wrangler@4 secret put GMAIL_OAUTH_REDIRECT_URI
# nilai: https://<domain-aplikasi>/api/tempmail-gmail-callback
```

---

## 3. Sekali setup di Cloudflare Worker

Jalankan dari root repo di Windows PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler@4 secret put GMAIL_CLIENT_ID
npx wrangler@4 secret put GMAIL_CLIENT_SECRET
npx wrangler@4 secret put PROVIDER_CREDENTIAL_ENCRYPTION_KEY
```

- Tempel Client ID / Client secret dari langkah 2.
- Untuk `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, disarankan **64 karakter hex**.
  Bila secret ini sudah ada di Worker, pakai nilai yang sama; jangan dibuat
  ulang. `wrangler secret put` **menimpa** nilai lama, bukan menambah.
- Jangan menaruh nilai ini di `.dev.vars` yang ter-commit, `wrangler.toml`,
  `email.html`, browser, issue, atau chat. Untuk membuat kunci baru tanpa
  menampilkannya di layar/chat, pipe langsung dari stdin:

  ```powershell
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler@4 secret put PROVIDER_CREDENTIAL_ENCRYPTION_KEY
  ```

  Wrangler membaca nilai dari stdin saat tidak interaktif; `wrangler secret
  list` hanya menampilkan **nama** secret, bukan nilainya.
- ⚠️ `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` dipakai **bersama** oleh vault
  `public.provider_credentials` (API key KIE, OpenKey, QwenCloud, OpusClip,
  OpenClips, kredensial OAuth Social Video, dll.) dan tabel
  `public.tempmail_gmail_connections`. **Jangan mengganti nilainya** bila
  sudah ada ciphertext lama. Mengganti kunci membuat seluruh ciphertext lama
  tidak bisa didekrip lagi. Bila terlanjur diganti: kembalikan kunci lama bila
  masih tersimpan, atau isi ulang semua kredensial di
  `/admin-control/providers.html` (khusus YouTube/TikTok Social Video lewat
  `/black-box/index.html` → **Status OAuth App Multi-User**) lalu putuskan dan
  hubungkan ulang akun Gmail dari `/email.html`.

Deploy Worker seperti biasa (CI repo atau `npx wrangler@4 deploy`). Tidak ada
proses server tambahan yang harus dinyalakan.

---

## 4. Sekali setup di Supabase

Jalankan SQL [`supabase/tempmail-gmail-connections.sql`](supabase/tempmail-gmail-connections.sql)
di Supabase SQL Editor, atau lewat migration tool yang dipakai project.
Tabel `public.tempmail_user_aliases` dari setup TempMail sebelumnya tetap
dipakai untuk menyimpan alias plus-addressing per user.

SQL tersebut:

- membuat `public.tempmail_gmail_connections`,
- mengaktifkan RLS,
- mencabut akses `anon`/`authenticated`,
- memberi akses hanya ke `service_role`,
- memanggil `pg_notify('pgrst', 'reload schema')` agar PostgREST langsung
  mengenal tabel.

Refresh token disimpan sebagai `refresh_token_ciphertext` + IV AES-GCM.
Browser hanya menerima status `connected/email`, bukan token.

---

## 5. Cara pakai

1. Login sebagai `admin` atau `owner`.
2. Buka menu **TempMail** (`/email.html`).
3. Klik **Hubungkan Gmail** → pilih akun `...@gmail.com` → izinkan
   `gmail.readonly`.
4. Google mengarahkan kembali ke `/email.html?gmail=connected`.
5. Pada kolom **Akhiran setelah tanda +**, ketik `1` (atau `shop-2026`,
   `verif_2`, dll.). Kosongkan bila ingin angka acak.
6. Klik **Generate ujung**. Hasilnya, misalnya:
   `sugionoofficial88+1@gmail.com`.
7. Pakai alamat itu untuk verifikasi. Inbox muncul di halaman yang sama,
   diperbarui otomatis tiap 15 detik; tombol **Refresh Inbox** tetap ada.
8. Klik **Generate ujung** lagi kapan saja untuk mengganti akhiran. Alias lama
   diganti untuk user tersebut; pesan lama tidak ikut tampil.
9. **Putuskan** menghapus koneksi Gmail dan alias aktif milik user itu.

Akhiran diizinkan: huruf, angka, `.`, `_`, `-`, maksimal 32 karakter, harus
dimulai huruf/angka. Karakter `@`, `+`, spasi, atau HTML ditolak server.

---

## 6. Keamanan

- Gate `admin`/`owner` diverifikasi ulang di server pada setiap action.
- JWT Supabase diperiksa ke `/auth/v1/user`; role dibaca dari `public.profiles`.
- State OAuth ditandatangani HMAC-SHA256 dengan client secret, berisi
  `user_id`, ID sesi acak, dan kedaluwarsa 10 menit.
- `gmail-connect` juga memasang cookie `genzai_gmail_oauth` (`HttpOnly`,
  `SameSite=Lax`, `Secure` di HTTPS, 10 menit). Callback memverifikasi cookie
  itu cocok dengan state sebelum menyimpan token, sehingga state milik akun
  lain tidak bisa dipakai untuk membingungkan koneksi Gmail. Cookie langsung
  dihapus setelah callback berhasil/gagal.
- Refresh token tidak pernah dikirim ke browser; disimpan terenkripsi
  AES-256-GCM dengan kunci 32 byte di secret Worker.
- Tabel koneksi RLS `service_role` only; diagnostik hanya menampilkan boolean
  dan petunjuk, bukan nilai secret.
- Scope `gmail.readonly` hanya bisa membaca, tidak bisa mengirim/menghapus.
  Karena scope ini membaca seluruh mailbox, Worker menyaring daftar pesan
  dengan `q=to:<alias>` **dan** memverifikasi header `To`/`Delivered-To`/dll.
  supaya pesan untuk alamat lain tidak pernah tampil.
- Isi HTML email tetap dirender di iframe `sandbox=""` dengan CSP ketat.
- `action=diagnostics` tidak membuat email dan tidak memanggil Gmail API
  dengan token; hanya cek konfigurasi + tabel Supabase.

---

## 7. Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Panel: "Mode Hubungkan Gmail belum aktif" | Salah satu dari 3 secret kosong / format kunci bukan 64 hex | Ulangi bagian 3, cek `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` |
| `redirect_uri_mismatch` | Redirect URI tidak persis terdaftar di Google Cloud | Daftarkan `https://<origin>/api/tempmail-gmail-callback`, atau set `GMAIL_OAUTH_REDIRECT_URI` lalu daftarkan nilai itu |
| `access_denied` / akun tidak bisa consent | Akun bukan test user saat status `Testing`, atau scope ditolak | Tambahkan test user / publish consent screen / pakai akun `@gmail.com` yang benar |
| "Google tidak mengirim refresh token" | Consent lama masih tersimpan, `prompt=consent` tidak muncul | Cabut akses aplikasi di <https://myaccount.google.com/permissions>, lalu klik Hubungkan ulang |
| "Sesi OAuth tidak cocok dengan browser" | Cookie pihak pertama diblokir, callback dibuka di browser/incognito lain, atau state kedaluwarsa | Izinkan cookie untuk domain aplikasi, pakai browser yang sama, lalu klik Hubungkan Gmail lagi |
| `invalid_grant` setelah beberapa hari | OAuth consent screen masih `Testing` (token 7 hari) atau akses dicabut | Publish app / hubungkan ulang; lihat [1](https://developers.google.com/identity/protocols/oauth2#expiration) |
| `Gmail API has not been used ... is disabled` | Gmail API belum di-enable di project yang sama dengan Client ID | Enable Gmail API, tunggu propagasi, coba lagi |
| `PGRST205` / tabel koneksi tidak dikenal | SQL belum dijalankan / schema cache belum reload | Jalankan `supabase/tempmail-gmail-connections.sql`, lalu `NOTIFY pgrst, 'reload schema'` |
| "Akun yang terhubung harus memakai @gmail.com" | Akun Google Workspace domain lain / typo `gamil.com` | Hubungkan ulang akun `@gmail.com`; plus-addressing tidak mengubah domain |
| Inbox kosong padahal email sudah dikirim | Pengirim memakai alamat dasar tanpa `+tag`, atau filter penerima cocok | Pastikan pengirim memakai persis `nama+tag@gmail.com`, lalu Refresh Inbox |
| "Akhiran Gmail ini sudah dipakai" | Kombinasi `+tag` bentrok dengan alias user lain | Pakai akhiran lain atau kosongkan kolom untuk angka acak |

---

## 8. Koeksistensi dengan mode lama

Mode C **tidak menghapus** keputusan `persistent_host` sebelumnya. Urutan
pemilihan:

1. Bila `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` +
   `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` lengkap → **Mode C** dipakai.
   `TEMPMAIL_API_URL` tidak dibutuhkan dan tidak dipanggil.
2. Bila Mode C belum dikonfigurasi dan `TEMPMAIL_API_URL` diisi → Mode B
   Tempmail-MCP persisten. Lihat [`TEMPMAIL-SETUP.md`](TEMPMAIL-SETUP.md)
   dan [`deploy/tempmail-mcp/README.md`](deploy/tempmail-mcp/README.md).
3. Bila `TEMPMAIL_PROVIDER=mailtm` → Mode A opsional non-Gmail.

`action=diagnostics` menampilkan `active_provider=gmailapi` bila Mode C
aktif, plus pemeriksaan `supabase_gmail_connections_table` dan
`gmail_provider`. Tidak ada perintah `secret delete` yang diperlukan untuk
berpindah ke Mode C.

[1]: https://developers.google.com/identity/protocols/oauth2#expiration
