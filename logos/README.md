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

| File | Isi |
| --- | --- |
| `assets/brand/gen-z-ai-sidebar.svg` | lockup horizontal: tile Z + wordmark `gen-z.ai`, latar transparan (tema gelap) |
| `assets/brand/gen-z-ai-sidebar-light.svg` | versi tema terang: wordmark navy + aksen `.ai` lebih pekat |
| `assets/brand/gen-z-ai-mark-tile.svg` | mark Z dalam tile rounded, 120×120 (1:1) |

Lockup sidebar 378.8 × 96 px (rasio 3.95:1), tinggi tampil 38px di desktop,
34px di tablet, 30px di layar ≤480px. Varian terang/gelap dipilih otomatis
lewat `html[data-genz-theme="light"]` di `navigation/navigation.js`.
