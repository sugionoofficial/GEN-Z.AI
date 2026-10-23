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
--   user-uploads/upscale-photos/outputs/<user-id>/<ts>-<rand>.jpg
--   user-uploads/upscale-videos/outputs/<user-id>/<ts>-<rand>.mp4
--
-- RETENSI (lihat STORAGE-RETENTION.md)
--   * generate-input/*        -> dihapus setelah 1 jam
--   * upscale-photos/*        -> dihapus setelah 24 jam
--   * upscale-videos/*        -> dihapus setelah 24 jam
--   Penghapusan dilakukan cron Worker memakai service-role key,
--   jadi user tidak butuh policy DELETE khusus untuk itu.
--
-- OUTPUT UPSCALE
--   Hasil upscale di-upload GitHub Actions memakai service role,
--   lalu `generation_history.result_url` menyimpan referensi
--   `supabase-private://user-uploads/…`. Policy SELECT di bawah
--   membuat user bisa membuat signed URL untuk hasilnya sendiri;
--   ADMIN/OWNER boleh membaca semua.
--
-- CATATAN
--   Bucket `dashboard-videos` tetap PUBLIK karena masih dipakai
--   konten situs (videos/, thumbnails/). Output upscale lama
--   (dashboard-videos/upscale-photos/outputs, dashboard-upscales)
--   tetap bisa dibuka sampai terhapus cron 24 jam.
-- =========================================================

-- 1. Buat / perbarui bucket privat
insert into storage.buckets (id, name, public, file_size_limit)
values ('user-uploads', 'user-uploads', false, 209715200)
on conflict (id) do update
    set public = false,
        file_size_limit = 209715200;

-- 2. Helper: cek path milik user yang login
--
--    user_owns_media_path       -> input + output (dipakai SELECT)
--    user_owns_media_input_path -> input saja (INSERT / DELETE)

create or replace function public.user_owns_media_path(object_name text)
returns boolean
language sql
stable
as $$
    select coalesce(
        object_name ~ (
            '^(generate-input|upscale-photos/inputs|upscale-videos/inputs'
            '|upscale-photos/outputs|upscale-videos/outputs)/'
            || auth.uid()::text
            || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$'
        ),
        false
    );
$$;

create or replace function public.user_owns_media_input_path(object_name text)
returns boolean
language sql
stable
as $$
    select coalesce(
        object_name ~ (
            '^(generate-input|upscale-photos/inputs|upscale-videos/inputs)/'
            || auth.uid()::text
            || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$'
        ),
        false
    );
$$;

-- 3. Policy user (hanya folder miliknya sendiri)

drop policy if exists "Users insert own media uploads" on storage.objects;
create policy "Users insert own media uploads"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'user-uploads'
        and public.user_owns_media_input_path(name)
    );

drop policy if exists "Users read own media uploads" on storage.objects;
create policy "Users read own media uploads"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'user-uploads'
        and public.user_owns_media_path(name)
    );

drop policy if exists "Users delete own media uploads" on storage.objects;
create policy "Users delete own media uploads"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'user-uploads'
        and public.user_owns_media_input_path(name)
    );

-- 4. Policy admin: boleh membaca semua media (dipakai halaman riwayat
--    admin untuk membuat signed URL hasil upscale user lain).
--
--    SECURITY DEFINER supaya pengecekan role tidak ikut terkena RLS
--    tabel profiles.

create or replace function public.is_media_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and upper(coalesce(p.role, '')) in ('ADMIN', 'OWNER')
    );
$$;

drop policy if exists "Admins read all media uploads" on storage.objects;
create policy "Admins read all media uploads"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'user-uploads'
        and public.is_media_admin()
    );
