-- =========================================================
-- GEN-Z.AI — BUCKET PRIVAT UNTUK UPLOAD USER
-- ---------------------------------------------------------
-- File: supabase/user-media-bucket.sql
--
-- Jalankan di Supabase SQL Editor.
--
-- LATAR BELAKANG
--   Sebelumnya foto/video/audio yang diunggah user disimpan di
--   bucket PUBLIK `dashboard-videos`. Siapa pun yang punya link
--   bisa membukanya. Mulai perubahan ini semua upload user masuk
--   ke bucket PRIVAT `user-uploads`, dan aplikasi membuat
--   signed URL berdurasi 1 jam untuk provider AI / GitHub Actions.
--
-- STRUKTUR PATH
--   user-uploads/generate-input/<user-id>/<random>.<ext>
--   user-uploads/upscale-photos/inputs/<user-id>/<ts>-<rand>.<ext>
--   user-uploads/upscale-videos/inputs/<user-id>/<ts>-<rand>.<ext>
--
-- RETENSI (lihat STORAGE-RETENTION.md)
--   * generate-input/*        -> dihapus setelah 1 jam
--   * upscale-photos/*        -> dihapus setelah 24 jam
--   * upscale-videos/*        -> dihapus setelah 24 jam
--   Penghapusan dilakukan cron Worker memakai service-role key,
--   jadi user tidak butuh policy DELETE khusus untuk itu.
--
-- CATATAN
--   Bucket `dashboard-videos` tetap PUBLIK karena masih dipakai
--   konten situs (videos/, thumbnails/) dan output upscale.
-- =========================================================

-- 1. Buat / perbarui bucket privat
insert into storage.buckets (id, name, public, file_size_limit)
values ('user-uploads', 'user-uploads', false, 209715200)
on conflict (id) do update
    set public = false,
        file_size_limit = 209715200;

-- 2. Helper: folder user yang diizinkan
--    (dipakai policy INSERT / SELECT / DELETE di bawah)

drop policy if exists "Users insert own media uploads" on storage.objects;
create policy "Users insert own media uploads"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'user-uploads'
        and (
            name ~ ('^generate-input/' || auth.uid()::text || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-photos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-videos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
        )
    );

drop policy if exists "Users read own media uploads" on storage.objects;
create policy "Users read own media uploads"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'user-uploads'
        and (
            name ~ ('^generate-input/' || auth.uid()::text || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-photos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-videos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
        )
    );

drop policy if exists "Users delete own media uploads" on storage.objects;
create policy "Users delete own media uploads"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'user-uploads'
        and (
            name ~ ('^generate-input/' || auth.uid()::text || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-photos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
            or name ~ ('^upscale-videos/inputs/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
        )
    );
