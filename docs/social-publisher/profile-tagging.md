# Menandai / Menautkan Akun di Caption

Berlaku untuk posting manual dan autopost (jadwal), pada kedua mode
(Foto Karakter AI & Outfit maupun Kata-kata Mutiara).

## 1. Yang TIDAK bisa dilakukan

**Men-tag akun orang lewat Facebook Graph API tidak dimungkinkan.** Tidak ada parameter
resmi untuk itu saat ini:

| Cara yang beredar | Status |
| --- | --- |
| `message_tags` pada `POST /{page-id}/feed` | **read-only** — dikirim tanpa error, tetapi tag tidak dibuat |
| Format `@[id:0:nama]` / `@[id:1:nama]` | tidak berfungsi lagi (dulu fitur tidak resmi) |
| Parameter `tags` pada unggah foto | butuh izin `publish_actions` yang **dihapus sejak 2018** |
| `to` / `with_tags` pada post Page | tidak menandai pengguna pada post feed |
| Open Graph Mention Tagging | hanya untuk custom Open Graph action, bukan post feed biasa |

Karena itu tag dengan notifikasi ke pemilik akun hanya bisa dibuat **manual di aplikasi
Facebook** (ketik `@` lalu pilih nama) setelah post terbit.

## 2. Yang didukung aplikasi ini: tautan profil

Isi dua kolom opsional — **Nama tampilan** dan **URL profil Facebook** — pada:

- panel **Posting manual** ("Tandai / tautkan profil"), dan
- panel **Buat jadwal autopost** ("Tandai / tautkan profil") — berlaku untuk semua post
  jadwal tersebut.

Hasilnya ditambahkan ke caption:

```
Cerita hari ini dari Jakarta ✨

🎵 Lagu Facebook: Musik Latar 1

👤 Budi Santoso — https://www.facebook.com/budi.santoso
```

- Nama + URL → `👤 Nama — url`
- Hanya URL → `👤 url`
- Hanya nama → `👤 Nama` (teks biasa, tanpa tautan)

Tautan bisa diklik pembaca, tetapi **tidak mengirim notifikasi** ke pemilik akun.

## 3. Pengamanan

- Hanya `https://` dan domain Facebook (`facebook.com`, `m./web./business.facebook.com`,
  `fb.com`, `fb.me`, `l.facebook.com`, `profile.facebook.com`) yang diterima. Selain itu
  tautan **dibuang** dari caption, sedangkan namanya tetap boleh tampil.
- Parameter pelacak (`?fref=…`) dibuang; `profile.php?id=…` tetap didukung.
- Panjang dibatasi: nama 80 karakter, URL 300 karakter (dicek juga oleh `CHECK` di database).
- URL divalidasi di server (API) — bukan hanya di browser — dan disimpan dalam bentuk sudah
  dibersihkan.

## 4. Risiko yang perlu diingat

Tautan di caption menambah risiko aksi ditolak Facebook (**code 368**). Bila itu terjadi,
kurangi tautan (termasuk tautan profil) dan variasikan caption. Lihat
`docs/security/credit-token-audit.md` §9.

## 5. Database

Migration: `supabase/social-post-tagging.sql` (idempotent, sudah dijalankan).

```sql
-- memasang tautan profil untuk satu jadwal
update public.social_post_schedules
   set tag_name = 'Budi Santoso',
       tag_url  = 'https://www.facebook.com/budi.santoso'
 where id = '<uuid-jadwal>';

-- menghapusnya
update public.social_post_schedules
   set tag_name = '', tag_url = ''
 where id = '<uuid-jadwal>';
```
