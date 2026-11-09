# TempMail — peta error & diagnostics

Dokumen ini adalah pendamping [`TEMPMAIL-SETUP.md`](../TEMPMAIL-SETUP.md)
(setup dasar). Fokusnya: **mengubah pesan error generik menjadi diagnosis
yang bisa ditindaklanjuti**, tanpa mengulang penjelasan arsitektur di sana.

Menu **TempMail** ada di `navigation/navigation.js` → `/email.html`
(khusus role `admin`/`owner`, diverifikasi ulang di server).

## Dua mode lama + Mode C: `@gmail.com` tanpa Docker

**IMAP tidak bisa dipakai langsung dari Cloudflare Worker** (butuh koneksi
TCP, bukan `fetch`). Karena itu dulu `@gmail.com` mengandalkan Mode B dengan
host Tempmail-MCP persisten. Sekarang ada **Mode C**: Worker memakai Gmail
REST API + OAuth sekali, tanpa IMAP, Docker, VPS, BIOS, Codespace, atau host
eksternal. Lihat
[`TEMPMAIL-GMAIL-CONNECT.md`](../TEMPMAIL-GMAIL-CONNECT.md).

Mode A (`TEMPMAIL_PROVIDER=mailtm`) adalah opsi terpisah bila domain Gmail
tidak wajib: Worker memanggil `https://api.mail.tm` langsung dari server
[1](https://docs.mail.tm/), tanpa port-forward, tanpa Codespace, dan tanpa
`TEMPMAIL_API_URL`. Mode A **tidak aktif otomatis** supaya kebutuhan
`@gmail.com` tidak berubah diam-diam.

Perbandingan:

| | Mode A (opsional, non-Gmail) | Mode B (lama, `@gmail.com`) | Mode C (utama, `@gmail.com`) |
|---|---|---|---|
| `TEMPMAIL_API_URL` | kosong | URL Tempmail-MCP persisten | tidak dipakai |
| Service luar | tidak ada | FastAPI + Docker/uvicorn | tidak ada |
| Domain email | domain aktif `mail.tm` | `@gmail.com` via IMAP | `@gmail.com` via plus-addressing |
| Kredensial | `token`+`password` di Supabase, hanya `service_role` | token Tempmail-MCP di Supabase | refresh token OAuth terenkripsi AES-GCM di Supabase |
| Pemeriksaan diagnostik | `builtin_mailtm` → `GET api.mail.tm/domains` | `tempmail_provider` → `/api/health`, `/api/providers`, `/openapi.json` | `gmail_provider` + `supabase_gmail_connections_table` |

`TEMPMAIL_PROVIDER=mailtm` mengaktifkan Mode A walaupun secret Mode B ada.
Untuk tetap di Mode B, isi `TEMPMAIL_API_URL` lewat
`npx wrangler@4 secret put TEMPMAIL_API_URL` dengan host persisten dan
jangan set `TEMPMAIL_PROVIDER=mailtm`.

Konsekuensi penting: Mode A menghasilkan alamat **bukan `@gmail.com`**.
Kalau layanan yang diverifikasi menolak domain disposable atau Anda memang
butuh `@gmail.com`, pakai **Mode C** (tanpa host persisten, tanpa Codespace).
Mode B tetap ada sebagai fallback bila secret OAuth Google belum diset.
Alternatif Gmail REST API di Worker dengan OAuth refresh token (tanpa IMAP)
**sudah diimplementasikan** sebagai Mode C; hanya butuh setup Google Cloud
satu kali.

## Action yang didukung `GET/POST /api/tempmail`

| Action | Method | Fungsi |
| --- | --- | --- |
| `alias` | GET | Baca alias milik user tanpa membuat email baru |
| `status` | GET | Alias untuk `alias` (kompatibilitas klien lama) |
| `diagnostics` | GET | Cek env, Supabase REST, dan `/api/providers` |
| `create` | POST | Pakai alias yang ada, atau buat baru (Mode C bila aktif) |
| `gmail-status` | GET | Status koneksi Gmail user (tanpa token) |
| `gmail-connect` | GET | URL Google OAuth yang ditandatangani Worker |
| `gmail-disconnect` | POST | Putuskan koneksi dan hapus alias aktif |
| `rotate` | POST | Generate akhiran `+tag` baru; `tag` opsional |
| `messages` | GET | Daftar pesan (Mode C difilter ke alias tepat) |
| `message` | GET | Isi pesan (`bodyText`, `bodyHtml`, `attachments`) |

Semua action melewati: verifikasi JWT ke Supabase Auth → cek role di
`public.profiles` (nilai `Administrator` dinormalkan jadi `admin`) →
akses `public.tempmail_user_aliases` dengan `service_role`, difilter
`user_id`.

## `action=diagnostics`

Dipanggil oleh tombol **🔍 Cek Konfigurasi** di `/email.html`. Contoh respons:

```json
{
  "ok": false,
  "checkedAt": "2026-11-08T20:00:00.000Z",
  "config": {
    "supabase_url": true,
    "supabase_anon_key": true,
    "supabase_service_role_key": true,
    "tempmail_api_url": true,
    "tempmail_api_host": "tempmail.example.com",
    "preferred_provider": "gmail,auto"
  },
  "checks": [
    { "name": "supabase_profiles", "ok": true, "status": 200, "detail": "", "hint": "" },
    { "name": "supabase_aliases_table", "ok": false, "status": 404,
      "detail": "HTTP 404: PGRST205 ...", "hint": "Tabel ... jalankan supabase/tempmail-user-aliases.sql ..." },
    { "name": "tempmail_provider", "ok": true, "status": 200, "providers": [
      { "name": "gmail", "disabled": true, "failures": 3 }
    ], "hint": "..." }
  ]
}
```

Yang **tidak** pernah dikirim: nilai `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`, token mailbox, atau kredensial provider. String
`detail` dipotong 300 karakter dan nilai `token=`/`api_key=`/`password=`
disamarkan sebelum dikirim ke browser maupun log Worker.

## Peta error → tindakan

| Pesan | Tahap | Tindakan |
| --- | --- | --- |
| `Konfigurasi autentikasi Supabase belum lengkap di Cloudflare.` | Auth | Isi `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| `Konfigurasi database TempMail belum lengkap.` | Supabase REST | Isi `SUPABASE_SERVICE_ROLE_KEY` |
| `Gagal memeriksa role akun TempMail (HTTP 4xx/5xx). …` | `profiles` | Cek secret service role & project yang sama dengan frontend |
| `Gagal membaca pemetaan alias TempMail (HTTP 404). … PGRST205` | `tempmail_user_aliases` | Jalankan [`supabase/tempmail-user-aliases.sql`](../supabase/tempmail-user-aliases.sql); file sudah menyertakan `pg_notify('pgrst', 'reload schema')` |
| `Gagal menyimpan alias TempMail. …` (409 ditangani khusus) | insert alias | 409 = email bentrok dengan user lain → otomatis diulang (maks. 3× per provider) |
| `TEMPMAIL_API_URL belum di-set. …` | provider | `npx wrangler@4 secret put TEMPMAIL_API_URL` (URL API Tempmail-MCP, bukan halaman UI) |
| `Provider gagal membuat email sementara. (HTTP 503: …)` | provider | Lihat `GET /api/providers` (bila tersedia); aktifkan provider atau set `TEMPMAIL_PROVIDER=auto` |
| `tempmail_provider · HTTP 404` di diagnostik | introspection | Cek `endpoints`/`capabilities`: bila `/api/health` atau `/openapi.json` JSON 2xx, abaikan; bila semua non-JSON, perbaiki `TEMPMAIL_API_URL` |
| `Detail: /api/health=404 (non-JSON), …` pada ketiga probe | host provider mati / salah domain | Lihat section "Semua probe 404 (non-JSON)": cek `curl -i <host>/api/health`, deploy ulang Tempmail-MCP, set ulang secret |
| `Provider TempMail gagal memproses permintaan. (HTTP …)` | inbox | Cek token/alias tersimpan & status server provider |
| `Permintaan timeout setelah 20 detik. Coba lagi.` | jaringan | Cek cold start / ketersediaan host provider |
| `Session tidak valid atau sudah kedaluwarsa.` | browser | Login ulang; samakan `assets/js/config.js` dengan `SUPABASE_URL` Worker |
| `Fitur TempMail hanya tersedia untuk role admin atau owner.` | otorisasi | Ubah role di `public.profiles` |
| `Akun Gmail belum dihubungkan.` | Mode C | Klik **Hubungkan Gmail** di `/email.html`, izinkan `gmail.readonly` |
| `redirect_uri_mismatch` | OAuth Google | Daftarkan `https://<origin>/api/tempmail-gmail-callback` di Google Cloud |
| `PGRST205` pada `tempmail_gmail_connections` | Supabase REST Mode C | Jalankan [`supabase/tempmail-gmail-connections.sql`](../supabase/tempmail-gmail-connections.sql) |
| `Pesan tidak ditemukan untuk alamat TempMail ini.` | isolasi Mode C | Worker menolak pesan yang bukan ditujukan ke `+tag` milik user; generate ujung baru bila perlu |

Pesan lama `Gagal memproses TempMail. Periksa konfigurasi Supabase dan
provider.` kini hanya muncul untuk kesalahan tak terduga yang tidak punya
pesan; kegagalan HTTP/JSON/timeout selalu membawa pesan spesifik, `detail`
yang disamarkan, dan `hint`.

## Kenapa `/api/providers` bisa 404?

Gejala yang sering dilaporkan:

```
❌ tempmail_provider · HTTP 404
Detail: HTTP 404:
Hint: Endpoint /api/providers tidak membalas JSON. ...
Provider: tidak ada data provider
```

`/api/providers` adalah endpoint **introspection/opsional** Tempmail-MCP.
Beberapa deployment tidak memilikinya:

- versi server lama / fork yang hanya membawa `POST /api/email` dan
  `GET /api/email/{email}/messages`;
- reverse proxy atau Cloudflare Worker yang hanya meneruskan path
  `/api/email*` ke backend;
- `TEMPMAIL_API_URL` yang salah (domain aplikasi GEN-Z.AI sendiri,
  halaman statis, atau base path kurang tepat).

Diagnostik sekarang melakukan tiga probe read-only secara paralel:

| Probe | Fungsi |
| --- | --- |
| `GET /api/health` | Bukti server API hidup (200/207 dengan JSON) |
| `GET /api/providers` | Daftar provider + status disabled (opsional) |
| `GET /openapi.json` | Daftar route yang benar-benar tersedia (`capabilities.create_email`, `capabilities.messages`) |

Aturan penilaian:

- `/api/providers` 404 + `/api/health` atau `/openapi.json` 2xx JSON →
  `ok: true`, hint menjelaskan 404 itu opsional dan **bukan kerusakan**.
- `/openapi.json` memuat `/api/email` → `ok: true` meski dua endpoint lain
  404.
- Semua probe non-JSON/404 → `ok: false`, hint meminta memeriksa URL dasar
  `TEMPMAIL_API_URL` (termasuk kemungkinan API dipasang di sub-path).
- Host `TEMPMAIL_API_URL` sama dengan host aplikasi → `ok: false` dengan
  peringatan **self-reference**.

Jadi jangan memperbaiki 404 itu dengan menambah route di Worker
GEN-Z.AI: perbaiki `TEMPMAIL_API_URL`, atau terima bahwa server provider
tidak menyediakan endpoint monitoring tersebut. Untuk memastikan fitur
intinya, cukup klik **📧 Buat Email** lalu **🔄 Refresh Inbox**.

## Semua probe `404 (non-JSON)`

Contoh hasil:

```
❌ tempmail_provider · HTTP 404
Detail: /api/health=404 (non-JSON), /api/providers=404 (non-JSON), /openapi.json=404 (non-JSON)
Probe: /api/health=404 (non-JSON), /api/providers=404 (non-JSON), /openapi.json=404 (non-JSON)
Endpoint inti: /api/email=false · /messages=false · /api/providers=false · /api/health=false
```

Ini **bukan** kasus "endpoint opsional 404". Ketika ketiga probe membalas
halaman HTML/plain-text 404, artinya host yang diisi di `TEMPMAIL_API_URL`
bukan server API TempMail-MCP yang aktif. Diagnostik kini menyertakan:

- `endpoints[].content_type` dan `endpoints[].sample` — cuplikan body yang
  sudah dibuang tag HTML-nya (mis. `nginx 404 Not Found`, `Vercel 404`,
  `Cloudflare Error`) untuk mengidentifikasi siapa yang membalas 404;
- `detail` berisi `Content-Type` + cuplikan tersebut;
- `steps` berisi langkah berurutan, termasuk perintah `curl -i` yang bisa
  disalin lewat tombol **📋 Salin perintah cek**;
- `config.app_host` dan `config.tempmail_api_host`, plus flag
  `tempmail_api_self_reference` bila host provider sama dengan domain
  aplikasi (deteksi juga memakai `META_REDIRECT_URI` dari `wrangler.toml`,
  sehingga ketahuan walau aplikasi dibuka lewat custom domain).

### Repo sumber **BUKAN host API**

Source upstream ada di
<https://github.com/sugionoofficial/Tempmail-MCP>. Di `src/api.py` ketiga
endpoint memang terdaftar: `APIRouter(prefix="/api")` dengan `GET /health`
dan `GET /providers`, serta `FastAPI(openapi_url="/openapi.json")`. README
hanya menyebut `http://localhost:8000` dan placeholder
`https://your-host/mcp/`; repo tidak punya workflow deploy, `homepage`,
atau GitHub Pages aktif. Jadi **URL repo GitHub tidak boleh dipakai sebagai
`TEMPMAIL_API_URL`** — GitHub melayani halaman repositori, bukan aplikasi
FastAPI. Diagnostik mendeteksi host `github.com` / `raw.githubusercontent.com`
/ `gitlab.com` / `bitbucket.org` dan memberi langkah deploy yang berbeda.

Menjalankan instance sendiri:

```bash
git clone https://github.com/sugionoofficial/Tempmail-MCP.git
cd Tempmail-MCP
docker compose up -d
curl -i http://localhost:8000/api/health   # harus 200 JSON
```

Worker Cloudflare **tidak bisa memanggil `localhost`**; expose service ke
HTTPS publik lewat VPS + reverse proxy, Cloudflare Tunnel, Render, atau
Railway. `TEMPMAIL_API_URL` lalu diisi URL dasar host itu (tanpa `/api` di
akhir; sertakan sub-path bila reverse proxy memasang API di sub-path).

> Catatan keamanan: repo upstream menyimpan `.env` berisi kredensial Gmail.
> Rotasi `GMAIL_APP_PASSWORD` dan hapus file tersebut dari riwayat Git
> sebelum dipakai produksi.

## Host GitHub Codespaces (`*.app.github.dev`)

> Untuk solusi tanpa Codespace yang tetap menghasilkan `@gmail.com`, pakai
> artefak [`deploy/tempmail-mcp/`](../deploy/tempmail-mcp/README.md): VPS +
> Docker + Caddy/Cloudflare Tunnel, lalu set `TEMPMAIL_API_URL` sekali.

Contoh host yang sering menipu: `<codespace>-8000.app.github.dev` (dulu juga
`*.githubpreview.dev`). Itu **URL port-forward GitHub Codespaces**, bukan
domain server produksi. Ciri-cirinya:

- hanya hidup selama Codespace menyala; saat di-stop/suspend, GitHub
  membalas halaman `404` HTML/plain-text;
- port `8000` default-nya **Private**, sehingga Worker Cloudflare tidak bisa
  mengaksesnya walaupun URL-nya benar;
- hostname berubah bila Codespace dihapus/dibuat ulang, jadi secret lama
  menjadi basi;
- skema `http://` sering ikut tertinggal, padahal sebaiknya `https://`.

Karena itu `Detail: /api/health=404 (non-JSON), /api/providers=404
(non-JSON), /openapi.json=404 (non-JSON)` dengan host semacam ini berarti
**gerbang Codespaces yang menjawab**, bukan aplikasi FastAPI. Diagnostik
menandainya dengan `tempmail_api_codespaces_url` dan memberi langkah:

1. Di dalam Codespace: `curl -i http://localhost:8000/api/health` → `200 JSON`.
2. Pastikan `cd Tempmail-MCP && docker compose up -d` berjalan.
3. Tab **Ports** → port `8000` → visibility **Public**, jangan stop Codespace.
4. Dari luar: `curl -i https://<codespace>-8000.app.github.dev/api/health`.
5. **Untuk produksi jangan pakai Codespaces.** Deploy ke host persisten
   (VPS + reverse proxy, Cloudflare Tunnel, Render, Railway, Fly.io), lalu
   `npx wrangler@4 secret put TEMPMAIL_API_URL` dengan URL dasar HTTPS baru.

Langkah perbaikan:

1. Pastikan service Tempmail-MCP benar-benar hidup:
   `curl -i https://<host>/api/health` → harus `200` dengan JSON, bukan HTML 404.
2. Bila service mati / domain lama (Render/Railway/VPS dihapus, free tier
   tidur, DNS berubah), deploy ulang dan catat URL dasar barunya.
3. Set ulang secret Worker:
   `npx wrangler@4 secret put TEMPMAIL_API_URL`.
   Nilainya **URL dasar**: `https://host` atau `https://host/prefix` bila API
   dipasang di sub-path. Jangan tambahkan `/api` di akhir (handler sudah
   menambahkan `/api/email`, `/api/health`, dst).
4. Jangan isi dengan domain aplikasi GEN-Z.AI / Worker
   `genzai.genzai-f37.workers.dev` — Worker itu tidak punya route
   `/api/health`, `/api/providers`, atau `/openapi.json`.
5. Bila server sengaja hanya membuka `POST /api/email` (tanpa endpoint GET
   diagnostik), probe GET akan tetap 404. Klik **📧 Buat Email** untuk uji
   langsung; kalau berhasil, fitur bisa dipakai.

Nilai `TEMPMAIL_API_URL` adalah secret Cloudflare dan **tidak tersimpan di
repo maupun di database Supabase**, sehingga tidak bisa dibaca/diperbaiki
dari kode. Gunakan baris `Perintah cek` di halaman diagnostik untuk
memverifikasi host tanpa membocorkan secret.

## Fallback provider

`TEMPMAIL_PROVIDER` boleh berupa satu nama atau daftar dipisah koma
(`gmail,mail.tm`); `auto` selalu ditambahkan sebagai fallback terakhir.
Untuk tiap kandidat, `POST /api/email?name=<provider>` dicoba; bila gagal,
kandidat berikutnya dipakai. Provider yang benar-benar menghasilkan email
disimpan di kolom `provider` dan dipakai lagi saat membaca inbox.

## Konfigurasi lokal

`.dev.vars.example` dan `scripts/check-local-dev-vars.mjs` sudah
mendokumentasikan/memperingatkan `TEMPMAIL_API_URL`. `npm run dev` tetap
tidak memblokir server bila variabel opsional ini kosong, tetapi akan
mencetak peringatan bahwa menu TempMail akan gagal.

## Catatan verifikasi proyek

Pada project Supabase `rvgioyenjgkprnssfpfr`: tabel
`public.tempmail_user_aliases` ada dengan RLS aktif, grant hanya untuk
`service_role`/`postgres`, dan service Auth/DB/REST/Pooler berstatus
`ACTIVE_HEALTHY`. Migrasi idempoten `tempmail_user_aliases` sudah
diterapkan agar tabel ikut terbentuk saat restore/branch, sekaligus
me-refresh schema cache PostgREST.

### Email Gmail sudah terkirim tetapi inbox TempMail kosong

Gmail API mengembalikan header `From` dan `To` di `payload.headers`, baik
pada format metadata maupun isi pesan. Worker membaca lokasi ini untuk
menampilkan pengirim dan memastikan pesan ditujukan ke alias aktif. Versi
sebelumnya salah membaca `headers` di tingkat atas sehingga pesan yang
sebenarnya ada dapat tersaring; deploy Worker yang sudah diperbaiki.

Pastikan alias `+tag` di TempMail sama dengan penerima email. Pencarian Gmail
saat ini tidak mencakup Spam atau Sampah dan menampilkan paling banyak 20
hasil terbaru sebelum penyaringan alias. Periksa juga folder tersebut di
Gmail jika pesan masih tidak muncul. Filter tampilan TempMail hanya menampilkan
pengirim `@opus.pro` atau `@app.opus.pro`; filter From bukan bukti keaslian.
