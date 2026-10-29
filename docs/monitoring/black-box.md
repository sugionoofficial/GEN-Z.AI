# BLACK BOX // MONITORING

Halaman `admin-control/monitoring.html` adalah "kotak hitam" situs: merekam apa
yang terjadi, memeriksa kesehatan layanan, dan mengubah masalah menjadi temuan
yang punya langkah perbaikan. Halaman ini hanya bisa dibuka **ADMIN** dan
**OWNER** (guard fail-closed seperti `black-box/index.html`).

## Isi halaman

| Bagian | Fungsi |
| --- | --- |
| Ringkasan | Status keseluruhan, jumlah aktivitas/error/akses DevTools 24 jam |
| Kesehatan Web | 7 pemeriksaan: situs, API, database, auth, storage, cron, Studio Medsos |
| Temuan & Cara Mengatasi | Hasil pemeriksaan + error berulang, lengkap dengan langkah perbaikan |
| Log Aktivitas Live | Aliran kejadian (kunjungan, error, DevTools, API gagal), auto-refresh 10 detik |
| Akses & DevTools | IP, kota/negara, ASN, colo, perangkat, status DevTools per pengunjung |
| Pemeriksaan Rutin | Interval pemeriksaan, masa simpan log, saklar alert |

## Alur data

```
Browser (security-beacon.js)                 Cron Worker (tiap menit)
        │                                            │
        │ POST /api/monitoring?action=ingest         │ runMonitoringCron()
        ▼                                            ▼
   api/monitoring.js  ──────────►  lib/monitoring/health.js
        │                                    │
        └──────────► Supabase: monitoring_events / _health_checks / _findings / _settings
```

`lib/monitoring/health.js` dipakai bersama API dan cron supaya hasil pemeriksaan
manual identik dengan yang terjadwal.

## IP dan lokasi: dari mana?

IP **tidak pernah** diambil dari browser. `api/monitoring.js` membacanya dari
`cf-connecting-ip` / `x-forwarded-for`, sedangkan kota, negara, ASN, dan colo
diambil dari objek `request.cf` milik Cloudflare (diteruskan `handler-adapter.js`
sebagai `req.cf`). Kiriman IP dari JavaScript diabaikan, jadi tidak bisa
dipalsukan pengunjung.

## Deteksi DevTools: batas kemampuannya

Browser tidak menyediakan API resmi. Beacon memakai dua heuristik:

1. **Selisih viewport** — `outerWidth - innerWidth > 160` (DevTools yang
   menempel/docked memperkecil viewport).
2. **Getter pada objek console** — objek dengan properti `id` yang punya getter
   dicetak ke console; DevTools yang memformat objek akan memicunya.

Konsekuensinya:

- **Positif palsu** bisa terjadi saat pengguna memperbesar zoom, memakai sidebar
  browser, atau jendela tidak maksimal.
- **Negatif palsu** terjadi bila DevTools dibuka pada jendela terpisah
  (*undocked*), karena viewport tidak berubah dan console tidak diformat.
- Karena itu data ini ditampilkan sebagai **indikasi**, bukan bukti. Temuan
  DevTools ditandai `warn`, bukan `critical`.

Kalau yang membuka DevTools adalah kamu sendiri, tekan **Tandai diketahui**.
Kalau bukan: ganti kata sandi akun tersebut, keluarkan sesi lain di Supabase →
Authentication → Sessions, lalu putar ulang kunci yang pernah terekspos.

## Pemeriksaan rutin

Cron Worker sudah berjalan setiap menit (`wrangler.toml` → `[triggers]`).
`runMonitoringCron()` hanya menjalankan pemeriksaan penuh bila
`monitoring_settings.last_scan_at` sudah lebih tua dari `scan_interval_minutes`
(default 15 menit), sehingga tidak membebani situs.

Saat pemeriksaan berjalan:

1. `monitoring_health_checks` diisi hasil 7 target.
2. `monitoring_findings` di-upsert berdasarkan `fingerprint` — temuan yang sama
   menambah `occurrence_count`, tidak membuat baris baru.
3. Temuan kategori `health` yang sudah normal otomatis berstatus `resolved`.
4. Log lebih tua dari `retention_days` dihapus.

## Pemasangan

1. Jalankan `supabase/monitoring-blackbox.sql` (idempotent).
2. Deploy Worker: `npm run deploy` (`/api/monitoring` dan cron baru ikut).
3. Buka **Admin Panel → MONITORING**, tekan **Periksa sekarang**.

Opsional: atur `MONITORING_SITE_URL` (Worker → Settings → Variables) bila
pemeriksaan "Situs web" harus menembak domain lain selain
`https://genzai.genzai-f37.workers.dev`.

## Mematikan beacon

Beacon dimuat otomatis oleh `navigation/navigation.js` pada setiap halaman yang
memakai navigasi bersama. Untuk halaman tertentu, tambahkan atribut berikut pada
`<html>`:

```html
<html lang="id" data-genz-monitoring="off">
```

Beacon juga otomatis tidak aktif bila `navigator.doNotTrack === "1"`.

## Batasan lain

- Log hanya berisi **metadata** (path, pesan error, perangkat, jaringan). Isi
  formulir, token, dan query string tidak disimpan — `normalizePath()` membuang
  bagian setelah `?`.
- Body event dibatasi 8 KB dan 40 event/menit per IP agar tabel tidak bisa
  dibanjiri.
- Pemeriksaan berjalan dari dalam Worker, jadi tidak bisa mendeteksi gangguan
  pada DNS tingkat akar atau blokir jaringan yang juga memutus Worker.
