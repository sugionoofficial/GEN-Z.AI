# Cutover ke project baru — `rvgioyenjgkprnssfpfr`

Dokumen ini khusus untuk perpindahan dari
`ycovbqmezhrvzobxqnyp` (Singapore, **dibatasi 402**) ke
`rvgioyenjgkprnssfpfr` (Singapore, baru).

Runbook umum: `migrasi/MIGRASI-MANUAL.md`.
Dokumen ini hanya berisi nilai akhir + urutan cutover + pemeriksaan akhir.

> Project target berada di **akun Supabase berbeda**, sehingga konektor/agen
> tidak bisa membacanya. Semua perintah dijalankan pemilik akun.

---

## 0. Nilai yang dipakai

| Item | Nilai |
|---|---|
| Project ref target | `rvgioyenjgkprnssfpfr` |
| URL target | `https://rvgioyenjgkprnssfpfr.supabase.co` |
| Region | ap-southeast-1 (Singapore) — sama dengan sumber, latensi tidak berubah |
| Publishable key target | `sb_publishable_...` (salin dari Dashboard → Settings → API Keys) |
| Service role target | `sb_secret_...` / JWT service_role (**jangan** ke browser/repo) |

Cek kesiapan dulu:

```bash
export MIGRATION_SRC_REF=ycovbqmezhrvzobxqnyp
export MIGRATION_SRC_SERVICE_KEY='<service_role sumber>'
export MIGRATION_DST_REF=rvgioyenjgkprnssfpfr
export MIGRATION_DST_SERVICE_KEY='<service_role target>'
npm run check:migration
```

---

## 1. Urutan cutover (jangan diacak)

### Fase A — skema + data (bisa sekarang)

`pg_dump` memakai koneksi DB yang **tidak** terkena 402, jadi fase ini jalan
walau Storage sumber masih dibatasi.

```bash
# sumber (Singapore) dan target (Singapore) — port 5432, session pooler
SRC=postgresql://postgres.ycovbqmezhrvzobxqnyp:PASS_SRC@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
DST=postgresql://postgres.rvgioyenjgkprnssfpfr:PASS_DST@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

pg_dump "$SRC" --no-owner --no-acl --schema=public -f genz_public.sql
pg_dump "$SRC" --no-owner --no-acl --schema=auth --schema-only -f genz_auth_schema.sql
```

Ekspor auth (wajib — tanpa ini semua akun hilang), lalu restore ke target.
Perintah lengkap: `MIGRASI-MANUAL.md` bagian 1–2.

Titik henti yang harus hijau sebelum lanjut:

```sql
select count(*) from auth.users;               -- 25
select count(*) from public.profiles;          -- 25
select count(*) from public.generation_history;-- 502
```

### Fase B — Storage (TUNGGU kuota pulih)

Selama sumber 402, **unduhan file gagal**. Pulihkan dulu (upgrade Pro atau
reset siklus billing), baru:

```bash
cd migrasi
OLD_URL=https://ycovbqmezhrvzobxqnyp.supabase.co \
NEW_URL=https://rvgioyenjgkprnssfpfr.supabase.co \
OLD_SERVICE_KEY='<service_role sumber>' \
NEW_SERVICE_KEY='<service_role target>' \
node migrate_bulk.mjs
```

Skrip ini otomatis:
- membuat bucket yang belum ada di target (8 bucket, properti ikut sumber),
- menyalin 112 objek (~265 MB) dengan **Cache-Control dari sumber**, bukan
  `max-age=3600` (v3 — lihat catatan di bawah),
- menulis `storage_fixup.sql` untuk memulihkan owner/timestamp,
- bisa di-resume: jalankan perintah yang sama lagi bila ada yang gagal.

### Fase C — Auth & Realtime di target

- Site URL: `https://genzai.genzai-f37.workers.dev`
- Redirect allow-list: `https://genzai.genzai-f37.workers.dev/**`,
  `http://localhost:3000/**`, `http://localhost:8787/**`
- **Anonymous sign-in ON** (wajib untuk Live Support Chat)
- Trigger `on_auth_user_created` ada (ikut `genz_auth_schema.sql`)
- Realtime publication: `providers`, `support_conversations`, `support_messages`

### Fase D — ubah aplikasi (paling akhir)

Jalankan alat cutover (mengganti **semua** referensi sekaligus):

```bash
npm run cutover -- --ref rvgioyenjgkprnssfpfr \
                  --publishable sb_publishable_xxxxxxxx --dry-run
```

Lihat rencananya dulu, lalu jalankan tanpa `--dry-run`.

Yang diubah otomatis:

| File | Perubahan |
|---|---|
| `assets/js/config.js` | `SUPABASE_URL` + `SUPABASE_KEY` |
| `.dev.vars.example` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| `tests/supabase-project-config.test.mjs` | konstanta `PROJECT_REF` |
| `tests/*.test.mjs` | fixture URL & nama token sesi |
| `migrasi/*.md` | tidak diubah otomatis (ditulis manual) |

Yang **tidak** diubah (sengaja): komentar sejarah, dan fixture
`tests/persistent-auth-session.test.mjs` yang memang menguji penolakan
sesi dari host lain.

Alat ini menolak `--publishable` berisi `sb_secret_*` atau JWT, karena kunci
itu tidak boleh ada di browser. Setelah selesai ia memverifikasi ulang dan
gagal bila masih ada referensi project lama di kode frontend.

Worker Cloudflare `genzai` — tiga secrets:

```
SUPABASE_URL=https://rvgioyenjgkprnssfpfr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role target>
SUPABASE_ANON_KEY=<publishable key target>
```

>`tests/supabase-project-config.test.mjs` mengunci `config.js` ke project
>aktif. Alat cutover di atas sudah menyesuaikannya — jangan mengubah
>`config.js` manual tanpa ikut mengubah test itu, kalau tidak `npm test`
>gagal dan CI memblokir PR.

---

## 2. Aturan urutan yang tidak boleh dilanggar

Deploy `config.js` membuat frontend **langsung** memakai DB baru. Jadi:

| Kalau deploy dilakukan | Akibat |
|---|---|
| Sebelum Fase A selesai | situs tampil kosong: login gagal, riwayat hilang |
| Sebelum Fase B selesai | 502 baris riwayat ada, tetapi media tidak bisa dibuka |
| Sebelum secrets Worker diganti | login jalan (client memakai project baru), API gagal 401/500 |

Urutan aman: **A → B → C → D**, lalu deploy.

---

## 3. Pemeriksaan akhir

| Cek | Cara | Harapan |
|---|---|---|
| Jumlah data | query `auth.users` / `generation_history` | 25 / 502 |
| Login akun lama | login biasa | berhasil (password ikut pindah) |
| Sesi lama | buka aplikasi | diminta login ulang (JWT `iss` berubah) — normal |
| Media | buka History & Dashboard | thumbnail + video tampil |
| Cache-Control | `select metadata->>'cacheControl', count(*) from storage.objects group by 1;` | mayoritas `31536000, immutable`, **bukan** `no-cache` |
| API | `GET /api/announcements` dengan token | `200`, bukan 402/500 |
| Live chat | buka panel chat sebagai tamu | anonymous sign-in jalan |
| Batas egress | Dashboard → Usage | tidak ada peringatan kuota di awal siklus |

---

## 4. Kenapa `migrate_bulk.mjs` diubah (v3)

Versi lama memaksa `Cache-Control: max-age=3600` saat mengunggah, **mengabaikan**
nilai dari sumber. Akibatnya objek hasil migrasi tersimpan dengan cache pendek
dan setiap tampilan mengunduh ulang penuh dari Storage — pola yang sama yang
menghabiskan kuota egress dan menyebabkan 402 pada project sebelumnya.

v3 menyalin `cacheControl` dari sumber, dan memakai `31536000, immutable`
hanya bila sumber tidak punya nilai. Setelah migrasi, verifikasi dengan query
di tabel pemeriksaan di atas.

---

## 5. Setelah cutover

1. Perbarui `migrasi/STATUS.md` (ref baru).
2. Putus GitHub integration di project lama, lalu sambungkan ke project baru.
3. **Pause** project lama 1–2 minggu sebagai cadangan; baru **delete** setelah yakin.
4. Jangan jalankan ulang migrasi dari project lama setelah ada aktivitas baru
   di project baru — bisa menimpa data yang lebih baru.
