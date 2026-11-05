-- =====================================================================
-- perbaiki-storage-rls.sql - jalankan di SQL Editor project TARGET (BARU)
-- =====================================================================
-- Gejala yang diperbaiki:
--   - Video di halaman dashboard/riwayat tidak bisa diputar.
--   - Foto/berkas hasil generate 400 atau 403.
--   - Bucket privat (user-uploads) selalu "Object not found" walau
--     berkasnya ada.
--
-- Kenapa terjadi: `pg_dump --schema=public` TIDAK menyertakan skema
-- `storage`. Skrip backup hanya memindahkan ISI tabel
-- (storage.buckets + storage.objects), bukan KEBIJAKAN aksesnya.
-- Akibatnya di project baru tidak ada satu pun RLS policy untuk
-- storage.objects, sehingga:
--   * akses ke bucket privat ditolak;
--   * berkas hasil di user-uploads tidak bisa dibuatkan signed URL.
--
-- Di project lama ada 18 kebijakan. Berkas ini mengembalikannya persis.
--
-- Catatan keamanan: semua kebijakan memakai bucket_id dan folder user,
-- jadi user hanya bisa membaca folder miliknya sendiri. Kebijakan baca
-- publik hanya untuk dashboard-videos dan topup-payment-assets — sama
-- seperti di project lama.
--
-- Aman dijalankan berulang (drop if exists lalu create).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kebijakan baca publik (bucket yang memang publik)
-- ---------------------------------------------------------------------
drop policy if exists "dashboard videos public read" on storage.objects;
create policy "dashboard videos public read"
    on storage.objects for select
    to public
    using (bucket_id = 'dashboard-videos'::text);

drop policy if exists "Public read topup payment assets" on storage.objects;
create policy "Public read topup payment assets"
    on storage.objects for select
    to public
    using (bucket_id = 'topup-payment-assets'::text);

-- ---------------------------------------------------------------------
-- 2. dashboard-videos: admin mengelola, user mengunggah input miliknya
-- ---------------------------------------------------------------------
drop policy if exists "dashboard videos admin upload" on storage.objects;
create policy "dashboard videos admin upload"
    on storage.objects for insert
    to authenticated
    with check ((bucket_id = 'dashboard-videos'::text) AND is_dashboard_admin());

drop policy if exists "dashboard videos admin update" on storage.objects;
create policy "dashboard videos admin update"
    on storage.objects for update
    to authenticated
    using ((bucket_id = 'dashboard-videos'::text) AND is_dashboard_admin())
    with check ((bucket_id = 'dashboard-videos'::text) AND is_dashboard_admin());

drop policy if exists "dashboard videos admin delete" on storage.objects;
create policy "dashboard videos admin delete"
    on storage.objects for delete
    to authenticated
    using ((bucket_id = 'dashboard-videos'::text) AND is_dashboard_admin());

drop policy if exists "Users can read own upscale photos" on storage.objects;
create policy "Users can read own upscale photos"
    on storage.objects for select
    to authenticated
    using (
        (bucket_id = 'dashboard-videos'::text)
        and ((storage.foldername(name))[1] = 'upscale-photos'::text)
        and ((storage.foldername(name))[2] = 'inputs'::text)
        and ((storage.foldername(name))[3] = (auth.uid())::text)
    );

drop policy if exists "Users can upload upscale photos to own folder" on storage.objects;
create policy "Users can upload upscale photos to own folder"
    on storage.objects for insert
    to authenticated
    with check (
        (bucket_id = 'dashboard-videos'::text)
        and ((storage.foldername(name))[1] = 'upscale-photos'::text)
        and ((storage.foldername(name))[2] = 'inputs'::text)
        and ((storage.foldername(name))[3] = (auth.uid())::text)
    );

drop policy if exists "Users upload own upscale video inputs" on storage.objects;
create policy "Users upload own upscale video inputs"
    on storage.objects for insert
    to authenticated
    with check (
        (bucket_id = 'dashboard-videos'::text)
        and ((storage.foldername(name))[1] = 'upscale-videos'::text)
        and ((storage.foldername(name))[2] = 'inputs'::text)
        and ((storage.foldername(name))[3] = (auth.uid())::text)
        and (name ~ (('^upscale-videos/inputs/'::text || (auth.uid())::text) || '/[0-9]+-[a-z0-9]{8}\.(mp4|webm|mov|m4v)$'::text))
    );

-- ---------------------------------------------------------------------
-- 3. user-uploads (PRIVAT) - ini yang membuat upload & hasil generate
--    bisa dibaca. Tanpa kebijakan ini, semua hasil di user-uploads
--    gagal dibuatkan signed URL.
-- ---------------------------------------------------------------------
drop policy if exists "Users read own media uploads" on storage.objects;
create policy "Users read own media uploads"
    on storage.objects for select
    to authenticated
    using ((bucket_id = 'user-uploads'::text) AND user_owns_media_path(name));

drop policy if exists "Users insert own media uploads" on storage.objects;
create policy "Users insert own media uploads"
    on storage.objects for insert
    to authenticated
    with check ((bucket_id = 'user-uploads'::text) AND user_owns_media_input_path(name));

drop policy if exists "Users delete own media uploads" on storage.objects;
create policy "Users delete own media uploads"
    on storage.objects for delete
    to authenticated
    using ((bucket_id = 'user-uploads'::text) AND user_owns_media_input_path(name));

drop policy if exists "Admins read all media uploads" on storage.objects;
create policy "Admins read all media uploads"
    on storage.objects for select
    to authenticated
    using ((bucket_id = 'user-uploads'::text) AND is_media_admin());

-- ---------------------------------------------------------------------
-- 4. topup-proofs (privat) - bukti transfer milik user
-- ---------------------------------------------------------------------
drop policy if exists "topup proofs users and admins view" on storage.objects;
create policy "topup proofs users and admins view"
    on storage.objects for select
    to authenticated
    using (
        (bucket_id = 'topup-proofs'::text)
        and (
            ((storage.foldername(name))[1] = (auth.uid())::text)
            or exists (
                select 1 from public.profiles
                 where profiles.id = auth.uid()
                   and lower(profiles.role) = any (array['admin'::text, 'owner'::text])
            )
        )
    );

drop policy if exists "topup proofs users upload own" on storage.objects;
create policy "topup proofs users upload own"
    on storage.objects for insert
    to authenticated
    with check (
        (bucket_id = 'topup-proofs'::text)
        and ((storage.foldername(name))[1] = (auth.uid())::text)
    );

drop policy if exists "topup proofs users delete own" on storage.objects;
create policy "topup proofs users delete own"
    on storage.objects for delete
    to authenticated
    using (
        (bucket_id = 'topup-proofs'::text)
        and ((storage.foldername(name))[1] = (auth.uid())::text)
    );

-- ---------------------------------------------------------------------
-- 5. topup-payment-assets - aset pembayaran, dikelola admin
-- ---------------------------------------------------------------------
drop policy if exists "Admins upload topup payment assets" on storage.objects;
create policy "Admins upload topup payment assets"
    on storage.objects for insert
    to authenticated
    with check (
        (bucket_id = 'topup-payment-assets'::text)
        and exists (
            select 1 from public.profiles
             where profiles.id = auth.uid()
               and lower(profiles.role) = any (array['admin'::text, 'owner'::text])
        )
    );

drop policy if exists "Admins update topup payment assets" on storage.objects;
create policy "Admins update topup payment assets"
    on storage.objects for update
    to authenticated
    using (
        (bucket_id = 'topup-payment-assets'::text)
        and exists (
            select 1 from public.profiles
             where profiles.id = auth.uid()
               and lower(profiles.role) = any (array['admin'::text, 'owner'::text])
        )
    )
    with check (
        (bucket_id = 'topup-payment-assets'::text)
        and exists (
            select 1 from public.profiles
             where profiles.id = auth.uid()
               and lower(profiles.role) = any (array['admin'::text, 'owner'::text])
        )
    );

drop policy if exists "Admins delete topup payment assets" on storage.objects;
create policy "Admins delete topup payment assets"
    on storage.objects for delete
    to authenticated
    using (
        (bucket_id = 'topup-payment-assets'::text)
        and exists (
            select 1 from public.profiles
             where profiles.id = auth.uid()
               and lower(profiles.role) = any (array['admin'::text, 'owner'::text])
        )
    );

-- =====================================================================
-- 6. VERIFIKASI - jalankan terpisah. Semua harus OK.
-- =====================================================================
with cek(no, cek, hasil, target) as (
    select 1, 'jumlah_kebijakan_storage_objects',
        (select count(*)::text from pg_policies
          where schemaname = 'storage' and tablename = 'objects'), '18'
    union all select 2, 'kebijakan_baca_user_uploads',
        (select count(*)::text from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and policyname = 'Users read own media uploads'), '1'
    union all select 3, 'bucket_publik',
        (select count(*)::text from storage.buckets where public), '3'
    union all select 4, 'jumlah_bucket',
        (select count(*)::text from storage.buckets), '8'
)
select cek, hasil, target,
       case when hasil = target then 'OK' else 'PERIKSA' end as status
from cek
order by no;
