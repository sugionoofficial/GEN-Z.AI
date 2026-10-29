# Pilihan Lagu Autopost — Manual, Satu Lagu Tetap, atau Acak

Berlaku untuk Social Publisher (autopost jadwal) dan posting manual.

## 1. Bisakah mengambil katalog musik resmi Facebook?

**Tidak.** Per 2026, Meta tidak menyediakan endpoint Graph API untuk:

- menampilkan katalog/pustaka musik resmi Facebook, atau
- memasang track dari pustaka musik Facebook ke post **Page** lewat API.

Yang di-publish lewat Graph API membawa audio di dalam berkasnya sendiri. Meta memang punya
*Audio API* untuk **Instagram Reels** (butuh Facebook Login, akun Business/Creator yang tertaut
Page, lalu `audio_id` dari hasil pencarian di-attach saat publish) — tetapi itu untuk Instagram,
bukan Facebook Page, dan aplikasi ini menerbitkan ke Page.

Konsekuensinya, "lagu Facebook" di GEN-Z.AI berarti **koleksi lagu milik akun**:
tabel `public.social_facebook_songs` diisi dari panel **Lagu Facebook** (unggah MP3/MP4/AAC)
atau tombol seed 8 musik instrumental bawaan.

## 2. Lagu hanya untuk Kata-kata Mutiara

Opsi lagu **hanya** tersedia pada mode *quote* (Kata-kata Mutiara). Foto **karakter AI & outfit
tidak memakai lagu sama sekali**: tidak ada pilihan lagu di panel, dan API/cron memaksa
`song_mode = 'off'` untuk `post_mode = 'character'` — termasuk untuk jadwal lama yang masih
menyimpan `use_random_song = true`.

## 3. Tiga mode lagu

Kolom `social_post_schedules.song_mode`:

| Nilai | Perilaku |
| --- | --- |
| `off` | Tanpa lagu. Caption bersih, video mutiara tanpa audio tambahan (memakai track bawaan). |
| `fixed` | **Selalu** lagu `song_id` yang dipilih pengguna, walau baru dipakai di post sebelumnya. Bila lagu dinonaktifkan/dihapus, autopost otomatis jatuh ke mode acak. |
| `random` | Acak dari lagu aktif, **menghindari lagu terakhir** selama masih ada opsi lain. |

`use_random_song` (boolean lama) tetap ditulis: bernilai `true` hanya untuk mode `random`.
Deployment lama yang belum mengenal `song_mode` tetap berjalan seperti sebelumnya.

## 4. Di halaman

- **Jadwal autopost** → blok "Lagu untuk jadwal ini" hanya muncul saat memilih mode
  **Kata-kata Mutiara** (tema lagu). Pilih mode, lalu pilih lagu — dropdown diisi dari koleksi
  aktif akun; kosong berarti belum ada lagu untuk dipilih. Pada mode foto karakter AI & outfit
  blok ini disembunyikan.
- **Posting manual → foto karakter** → tidak ada pilihan lagu (hanya keterangan bahwa musik
  tersedia untuk Kata-kata Mutiara).
- **Posting manual → kata-kata mutiara** → "Musik auto-play video mutiara": lagu dipilih lalu
  digabungkan ke dalam berkas video; opsi acak tetap jadi bawaan.
- Kartu **Lagu Facebook** menampilkan seluruh koleksi (jumlah aktif, pemutar audio, status).

Ringkasan tiap jadwal di daftar menampilkan mode yang dipakai, contoh: `🎵 lagu tetap: Musik Latar 1`
atau `🎵 lagu acak (hindari lagu terakhir)`.

## 5. Operasi database

```sql
-- lihat pilihan lagu per jadwal
select s.id, s.post_mode, s.song_mode, s.song_id, f.title
  from public.social_post_schedules s
  left join public.social_facebook_songs f on f.id = s.song_id;

-- paksa satu jadwal memakai lagu tertentu
update public.social_post_schedules
   set song_mode = 'fixed', song_id = '<uuid-lagu>', use_random_song = false
 where id = '<uuid-jadwal>';

-- kembalikan ke acak
update public.social_post_schedules
   set song_mode = 'random', song_id = null, use_random_song = true
 where id = '<uuid-jadwal>';
```

Migration: `supabase/social-song-selection.sql` (idempotent, sudah dijalankan). Migrasi ini juga
mematikan pilihan lagu pada seluruh jadwal mode karakter.

Contoh mengganti judul lagu:

```sql
update public.social_facebook_songs
   set title = 'Musik Latar 1', updated_at = now()
 where id = '<uuid-lagu>';
```

## 6. Catatan penting soal judul lagu

Judul lagu yang berasal dari nama berkas unduhan (contoh
`FDownload.app 1125438713302255 (320kbps)`) dibersihkan sebelum masuk caption; bila tidak layak,
blok lagu dihapus. Health check `public.social_publisher_health()` memunculkan alert
`SONG_TITLE_NOT_CAPTION_SAFE` bila seluruh lagu aktif berjudul seperti itu.
Ganti judulnya di kartu **Lagu Facebook** agar baris lagu muncul lagi di caption.
Satu-satunya lagu di akun ini sudah diganti menjadi **"Musik Latar 1"**, sehingga health check
kembali bersih (`songs.unusable_title = 0`).

Lihat juga: `docs/security/credit-token-audit.md` §9 (kenapa caption seperti itu membuat
autopost ditolak Facebook dengan code 368).
