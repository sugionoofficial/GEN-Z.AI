# TempMail — peta error & diagnostics

Dokumen ini adalah pendamping [`TEMPMAIL-SETUP.md`](../TEMPMAIL-SETUP.md)
(setup dasar). Fokusnya: **mengubah pesan error generik menjadi diagnosis
yang bisa ditindaklanjuti**, tanpa mengulang penjelasan arsitektur di sana.

Menu **TempMail** ada di `navigation/navigation.js` → `/email.html`
(khusus role `admin`/`owner`, diverifikasi ulang di server).

## Action yang didukung `GET/POST /api/tempmail`

| Action | Method | Fungsi |
| --- | --- | --- |
| `alias` | GET | Baca alias milik user tanpa membuat email baru |
| `status` | GET | Alias untuk `alias` (kompatibilitas klien lama) |
| `diagnostics` | GET | Cek env, Supabase REST, dan `/api/providers` |
| `create` | POST | Pakai alias yang ada, atau buat baru dengan fallback provider |
| `messages` | GET | Daftar pesan (dinormalisasi: `id`, `subject`, `from`, `preview`, `createdAt`) |
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
| `Provider gagal membuat email sementara. (HTTP 503: …)` | provider | Lihat `GET /api/providers`; aktifkan provider atau set `TEMPMAIL_PROVIDER=auto` |
| `Provider TempMail gagal memproses permintaan. (HTTP …)` | inbox | Cek token/alias tersimpan & status server provider |
| `Permintaan timeout setelah 20 detik. Coba lagi.` | jaringan | Cek cold start / ketersediaan host provider |
| `Session tidak valid atau sudah kedaluwarsa.` | browser | Login ulang; samakan `assets/js/config.js` dengan `SUPABASE_URL` Worker |
| `Fitur TempMail hanya tersedia untuk role admin atau owner.` | otorisasi | Ubah role di `public.profiles` |

Pesan lama `Gagal memproses TempMail. Periksa konfigurasi Supabase dan
provider.` kini hanya muncul untuk kesalahan tak terduga yang tidak punya
pesan; kegagalan HTTP/JSON/timeout selalu membawa pesan spesifik, `detail`
yang disamarkan, dan `hint`.

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
