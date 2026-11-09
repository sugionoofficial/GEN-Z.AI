# Kredensial Opus di Supabase

1. Jalankan `supabase/opus-credentials.sql` pada SQL Editor project Supabase yang dipakai aplikasi.
2. Pastikan Worker memiliki `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan secret `PROVIDER_CREDENTIAL_ENCRYPTION_KEY` (atau `API_KEY_ENCRYPTION_SECRET`). Jangan bagikan atau ganti kunci enkripsi tanpa memigrasikan data terenkripsi. Vault refresh OAuth yang sudah ada juga harus dikonfigurasi sesuai dokumentasinya.
3. Deploy aplikasi. Login sebagai admin/owner, buka **Kredensial Opus** di navigasi, tambah akun dan klik Simpan pada setiap formulir. Nilai token tidak dapat dibaca kembali dari halaman; hapus dan tambahkan ulang untuk menggantinya. Tombol + dan − menambah formulir atau menghapus akun tersimpan tanpa batas jumlah slot aplikasi.
4. Migrasi secret Worker tidak otomatis: masukkan tiap akun lama, uji generate dan refresh, lalu hapus `OPUS_AUTH_TOKEN`, `OPUS_AUTH_TOKEN_1`, dst. beserta refresh token terkait dari Cloudflare secara manual. Selama masih ada, secret lama tetap ikut pool sebagai fallback. Jangan menghapus kunci enkripsi atau tabel vault refresh token.

Tabel hanya dapat diakses service role; endpoint memverifikasi sesi dan role profil di server. Token disimpan terenkripsi AES-256-GCM. Perhatikan batas penyimpanan/permintaan Supabase dan Cloudflare walaupun tidak ada batas slot tetap di aplikasi.
