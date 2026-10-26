# TENCENT AI ART — Foto jadi Anime (halaman Generate)

Model baru: **`tencent-aiart-image-to-image`**
Nama di halaman Generate: **Tencent AI Art — Foto jadi Anime**

Fungsinya: user unggah **1 foto asli** + (opsional) prompt, lalu Tencent
mengubahnya menjadi gambar bergaya anime / kartun / guofeng / 3D / realistis.

---

## 1. Yang perlu disiapkan di Tencent Cloud

| Langkah | Di mana | Hasil |
| --- | --- | --- |
| Buka produk AI Art (混元生图) → **立即使用** | https://console.cloud.tencent.com/aiart | Akun terdaftar sebagai pemakai AI Art |
| Klaim paket gratis | Console AI Art / 混元生图 → 免费资源包 | **50 gambar gratis** (berlaku 1 tahun) untuk 图像风格化（图生图） |
| Buat API key | Console → **访问管理 CAM** → API Keys | **SecretId** + **SecretKey** |

Penting soal biaya (jujur, jangan sampai kaget):

- 50 gambar pertama **gratis** (paket gratis otomatis dipakai lebih dulu).
- Setelah paket gratis habis, Tencent **tidak** otomatis beralih ke tagihan
  berbayar. Request akan gagal dengan pesan dari Tencent sampai kamu
  mengaktifkan mode 后付费 (postpaid) di console.
- Kalau mode berbayar diaktifkan, harga resmi 图像风格化（图生图）≈
  **0,099 元/gambar (±Rp230)** untuk pemakaian kecil. Itu biaya ke Tencent,
  terpisah dari kredit GEN-Z.AI.
- Gambar yang gagal **tidak** ditagih Tencent.

Region default: **ap-guangzhou**. Bisa diganti lewat Worker variable
`TENCENT_AIART_REGION` (mis. `ap-shanghai`) kalau akunmu di region lain.

---

## 2. Simpan kredensial (cukup dari HP)

Kredensial **tidak** disimpan di browser dan **tidak** perlu `wrangler secret`:
GEN-Z.AI menyimpannya terenkripsi di tabel `provider_credentials`.

1. Buka **Admin Panel → Providers**.
2. Cari **Tencent AI Art** (provider `tencent-aiart`).
   Kalau belum ada, jalankan dulu SQL di langkah 3.
3. Isi kredensial dengan format **satu baris**:

   ```
   SecretId|SecretKey
   ```

   Contoh:

   ```
   AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx|Gu5t9xGxxxxxxxxxxxxxxxxxxxxxx
   ```

   Format lain yang juga diterima: `SecretId:SecretKey`, `SecretId,SecretKey`,
   atau JSON `{"secretId":"...","secretKey":"...","region":"ap-guangzhou"}`.
4. Simpan, lalu tekan tombol tes di panel admin.

> `TENCENT_TOKENHUB_KEY` **tidak** dipakai di sini. TokenHub adalah produk
> berbeda; AI Art memakai pasangan SecretId/SecretKey (signature TC3).

---

## 3. Daftarkan provider + model di Supabase

Selama baris model belum ada di tabel `models`, halaman Generate akan
menolak dengan **"Model is not configured"** — itu memang perilaku yang
benar, bukan bug.

1. Buka **Supabase → SQL Editor**.
2. Tempel seluruh isi file `supabase/tencent-aiart-provider-models.sql`.
3. **Run**. File ini idempotent (aman dijalankan berulang).

Yang dilakukan file itu:

1. Menambah baris provider `tencent-aiart`.
2. Menambah baris model `tencent-aiart-image-to-image` dengan **flat credit
   5 kredit** (tidak ada pilihan resolusi di form).
3. Memperbarui izin baca bucket privat `user-uploads` supaya hasil AI Art
   (`aiart-outputs/<user-id>/…`) bisa dibuka di halaman History.

Alternatif tanpa SQL: **Admin Panel → Models → tambah model** dengan
`model_id = tencent-aiart-image-to-image`, provider `tencent-aiart`,
status `active`, resolusi **kosong**, credit 5. Tapi bagian izin baca pada
poin 3 tetap butuh SQL.

---

## 4. Sesuaikan credit (opsional)

**Admin Panel → Models → Tencent AI Art — Foto jadi Anime**

- `credit_480p` dipakai sebagai **satu-satunya** harga (karena model ini flat).
- `credit_720p` / `credit_1080p` dibiarkan kosong supaya tidak menyesatkan.
- Default 5 kredit hanyalah angka awal — silakan ubah sesuai harga jualmu.

---

## 5. Cara pakai di halaman Generate

1. Buka `/generate` → pilih model **Tencent AI Art — Foto jadi Anime**.
2. Unggah **1 foto** (JPG/PNG/WebP; sisi 50–5000 px).
3. (Opsional) isi **Prompt** dan **Negative Prompt**.
4. Pilih **Gaya Gambar** dan **Seberapa Mirip Foto Asli**.
5. Tekan Generate. Model ini **sinkron**: hasil langsung muncul di History
   tanpa polling (biasanya 5–30 detik).

Gaya yang tersedia (kode resmi Tencent):

| Pilihan | Kode | Arti |
| --- | --- | --- |
| Anime | 201 | 日系动漫 (default Tencent) |
| Kartun | 301 | 游戏卡通手绘 |
| Anime klasik | 204 | 复古动漫 |
| Guofeng | 203 | 唯美古风 |
| Lukisan tinta | 101 | 水墨画 |
| 3D | 116 | 3D |
| Realistis | 401 | 通用写实 |
| Bebas | 000 | tanpa gaya tetap |

Kemiripan → parameter `Strength` Tencent:

| Pilihan | Strength | Efek |
| --- | --- | --- |
| Sangat mirip | 0.45 | wajah & pose paling dipertahankan |
| Seimbang | 0.65 | default, sesuai anjuran Tencent 0.6–0.8 |
| Banyak diubah | 0.85 | lebih bebas, wajah bisa berubah |

---

## 6. Bagaimana hasil disimpan

- Tencent membalas gambar sebagai base64 (atau URL yang hanya berlaku 1 jam).
  Worker langsung menyalinnya ke **Supabase Storage**:
  `user-uploads/aiart-outputs/<user-id>/<waktu>-<acak>.jpg`
- Riwayat menyimpan referensi stabil
  `supabase-private://user-uploads/aiart-outputs/…`, lalu API menukarnya
  menjadi signed URL 30 menit saat dibaca.
- Prefix `aiart-outputs` **tidak** masuk daftar retensi otomatis
  (`lib/storage-retention/cleanup.js`), jadi hasil generate user tidak ikut
  terhapus setelah 1 jam / 24 jam.

---

## 7. Kalau gagal, pesannya apa

| Pesan | Artinya |
| --- | --- |
| `Provider API credential is unavailable` | Kredensial di Admin → Providers belum diisi / gagal didekripsi |
| `SecretKey salah atau tidak cocok dengan SecretId…` | Salah pasangan kunci (AuthFailure.SignatureFailure) |
| `Produk AI Art belum diaktifkan…` | Buka console AI Art → 立即使用 |
| `Kuota gratis AI Art habis…` | 50 gambar gratis terpakai; aktifkan postpaid atau tunggu paket baru |
| `Foto acuan terlalu besar…` | Kirim base64 > 8 MB; unggah foto lebih kecil |
| `Tencent gagal mengunduh foto…` | Signed URL tidak terjangkau dari sisi Tencent; Worker mencoba kirim base64 dan memberi pesan ini kalau foto > 6 MB |

Kalau penyimpanan hasil gagal, kredit **dikembalikan** dan request ditolak —
kita tidak pernah menandai riwayat "success" untuk gambar yang tidak bisa dibuka.

---

## 8. Catatan teknis

- Signature: TC3-HMAC-SHA256, `X-TC-Version: 2022-12-29`, service `aiart`,
  memakai Web Crypto (`crypto.subtle`) — jalan di Cloudflare Worker
  (`nodejs_compat`). Diuji terhadap vektor resmi Tencent di
  `tests/tencent-aiart.test.mjs`.
- Model ini **sengaja tidak didaftarkan** di `api/generate-status.js`: tidak
  ada task async untuk dipolling, sehingga tidak ada kemungkinan polling
  mengubah riwayat "success" menjadi gagal.
- Cache-buster yang dinaikkan: `generate-app.js?v=20261026-tencent-aiart`,
  `generate-submit.js?v=20261026-sync-result`,
  `generate-request.js?v=20261026-sync-result`,
  `generate-model.js?v=20261026-tencent-aiart`.
