# GEN-Z.AI — Logo

Logo 1:1 (persegi), dibuat sebagai vektor sehingga tajam di semua ukuran.

## File

| File | Isi | Ukuran |
| --- | --- | --- |
| `gen-z-ai-logo.svg` | Lockup lengkap: mark **Z** + wordmark `GEN-Z.AI` | 1024 × 1024 (vektor) |
| `gen-z-ai-logo-1024.png` | Versi raster dari lockup | 1024 × 1024 |
| `gen-z-ai-logo-2048.png` | Versi raster resolusi tinggi | 2048 × 2048 |
| `gen-z-ai-mark.svg` | Mark **Z** saja (untuk ikon / avatar / favicon) | 1024 × 1024 (vektor) |
| `gen-z-ai-mark-1024.png` | Mark **Z** saja | 1024 × 1024 |
| `gen-z-ai-mark-2048.png` | Mark **Z** saja, resolusi tinggi | 2048 × 2048 |

## Presisi margin

Komposisi dibuat supaya **jarak kiri = kanan = atas = bawah**, diukur dari
ink terluar (bukan dari kotak pembungkus):

| File | Ink yang terpakai | Margin tiap sisi |
| --- | --- | --- |
| lockup 1024 | 620 × 620 px | **202 px** |
| lockup 2048 | 1240 × 1240 px | **404 px** |
| mark 1024 | 400 × 400 px | **312 px** |

Kotak konten lockup sengaja dibuat persis bujur sangkar: jarak antara mark dan
wordmark disetel otomatis (`GAP = lebar_wordmark − tinggi_Z − tinggi_wordmark`)
sehingga tinggi total sama dengan lebar wordmark.

## Warna

| Peran | Nilai |
| --- | --- |
| Violet (utama) | `#8D7DFF` |
| Ungu muda (highlight) | `#D3C6FF` |
| Biru | `#6FB4FF` |
| Cyan | `#55D9F2` |
| Latar gelap | `#04050B` → `#0B0C1C` → `#1A1B40` (radial) |
| Wordmark | `#FFFFFF` → `#EDEBFF` → `#C9C5EE` |

## Catatan pemakaian

- Untuk ukuran kecil (< 64 px) pakai `gen-z-ai-mark.svg`; wordmark akan
  kehilangan keterbacaan.
- Latar logo sudah termasuk di dalam kanvas 1:1. Kalau butuh versi transparan,
  hapus `<rect ... fill="url(#bgGlow)"/>` dan elemen `<circle ... fill="url(#halo)"/>`
  dari SVG.
- Jangan regangkan (selalu 1:1), jangan ganti warna gradient, dan jangan
  menambahkan efek bayangan di luar yang sudah ada.


## Aset sidebar (dipakai di aplikasi)

Sidebar aplikasi (dibuat oleh `navigation/navigation.js`) memakai lockup
horizontal yang sama dengan navbar landing page:

| File | Isi |
| --- | --- |
| `assets/brand/genz-ai-logo.png` | lockup horizontal `GEN-Z.AI` (chrome + aksen merah), latar transparan, 720 × 293 |

Ukuran tampil: lebar **164px** di desktop, **140px** di ≤768px, **126px** di
≤480px (tinggi otomatis, rasio 2.46:1). Di tema terang, logo diberi latar
gelap `#10151f` supaya wordmark putihnya tetap terbaca.

Aset lama berikut tidak dipakai lagi oleh sidebar (disimpan untuk arsip/pemakaian lain):
`gen-z-ai-sidebar.svg`, `gen-z-ai-sidebar-light.svg`, `gen-z-ai-mark-tile.svg`.


## Favicon & app icon

| File | Ukuran | Dipakai untuk |
| --- | --- | --- |
| `assets/brand/favicon.svg` | 100×100 (vektor) | favicon modern (Z 74% supaya tegas di tab) |
| `assets/brand/favicon-16/32/48/96.png` | 16–96 px | favicon raster |
| `assets/brand/favicon.ico` | 16+32+48+96 | fallback `/favicon.ico` |
| `assets/brand/favicon-192.png` | 192 px | Android/PWA |
| `assets/brand/apple-touch-icon.png` | 180 px | iOS home screen |
| `assets/brand/app-icon.svg` / `-512` / `-1024` | 512/1024 | manifest PWA + app icon |

Semua 40 halaman HTML memuat:

```html
<link rel="icon" href="/assets/brand/favicon.ico?v=1" sizes="any">
<link rel="icon" href="/assets/brand/favicon.svg?v=1" type="image/svg+xml">
<link rel="icon" href="/assets/brand/favicon-32.png?v=1" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/brand/favicon-16.png?v=1" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png?v=1" sizes="180x180">
```
