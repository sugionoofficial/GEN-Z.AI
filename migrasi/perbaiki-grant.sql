-- =====================================================================
-- perbaiki-grant.sql - jalankan di SQL Editor project TARGET (BARU)
-- =====================================================================
-- Gejala yang diperbaiki:
--   GET /rest/v1/profiles -> 404
--   "Could not find the table 'public.profiles' in the schema cache"
--   Login gagal dengan pesan "Gagal mengambil profile"
--
-- Kenapa terjadi: skrip backup memakai `pg_dump --no-privileges`, sehingga
-- GRANT untuk role `anon`, `authenticated`, dan `service_role` TIDAK ikut
-- tersalin. Tabelnya ada dan berisi, tetapi ketiga role itu tidak punya
-- hak akses. PostgREST lalu menjawab 404 (bukan 403) karena dari sudut
-- pandangnya tabel itu tidak terlihat.
--
-- Inilah yang membuat Data API tidak bisa membaca apa pun meskipun
-- verify-restore.sql melaporkan 60/60 tabel PASS: berkas itu memeriksa
-- jumlah baris lewat koneksi admin, bukan lewat peran aplikasi.
--
-- Aman dijalankan berulang: GRANT bersifat idempoten.
--
-- BAGIAN 7 menangani masalah berikutnya: PGRST205 "Could not find the table
-- in the schema cache". Itu BUKAN masalah hak akses, melainkan cache skema
-- PostgREST yang basi. Penyebabnya `session_replication_role = replica` pada
-- restore: setelan itu mematikan SEMUA trigger pengguna tanpa kecuali,
-- termasuk trigger DDL milik Supabase (pgrst_ddl_watch) yang memberi tahu
-- PostgREST bahwa skema berubah. Tanpa pemberitahuan itu, PostgREST tetap
-- memakai daftar tabel lamanya (kosong).
-- =====================================================================

-- 1. Hak pakai skema.
grant usage on schema public to anon, authenticated, service_role;

-- 2. Hak atas semua tabel yang sudah ada sekarang.
grant select, insert, update, delete
    on all tables in schema public
    to anon, authenticated, service_role;

-- 3. Hak atas sequence (dibutuhkan untuk kolom bigserial/identity).
grant usage, select
    on all sequences in schema public
    to anon, authenticated, service_role;

-- 4. Hak atas fungsi (RPC). Banyak fitur memakai RPC, bukan REST biasa.
grant execute
    on all functions in schema public
    to anon, authenticated, service_role;

-- 5. Default privileges: tabel/fungsi BARU otomatis mewarisi hak yang sama.
--    Tanpa ini, tabel yang dibuat kemudian akan mengulang masalah yang sama.
alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
    grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

-- =====================================================================
-- 6. VERIFIKASI - jalankan bagian ini terpisah setelah perintah di atas.
--    Semua baris harus 'OK'.
-- =====================================================================
with cek(no, cek, hasil, target) as (
    select 1, 'tabel_tanpa_grant_anon',
        (select count(*)::text
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and not has_table_privilege('anon', c.oid, 'SELECT')), '0'
    union all select 2, 'tabel_tanpa_grant_authenticated',
        (select count(*)::text
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and not has_table_privilege('authenticated', c.oid, 'SELECT')), '0'
    union all select 3, 'tabel_tanpa_grant_service_role',
        (select count(*)::text
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and not has_table_privilege('service_role', c.oid, 'SELECT')), '0'
    union all select 4, 'profiles_select_anon',
        (select case when has_table_privilege('anon','public.profiles','SELECT')
                     then 'ya' else 'tidak' end), 'ya'
    union all select 5, 'jumlah_tabel_public',
        (select count(*)::text from pg_tables where schemaname = 'public'), '60'
)
select cek, hasil, target,
       case when hasil = target then 'OK' else 'PERIKSA' end as status
from cek
order by no;

-- =====================================================================
-- 7. SEGARKAN CACHE SKEMA POSTGREST
--    Jalankan ini kalau masih muncul PGRST205 walau hak akses sudah benar.
--    Ini yang memberi tahu Data API bahwa tabel-tabel baru sudah ada.
-- =====================================================================
notify pgrst, 'reload schema';
notify pgrst, 'reload config';

-- Kalau NOTIFY di atas belum cukup (PostgREST kadang perlu waktu beberapa
-- detik), ada dua cara lain:
--
-- a) Tunggu 5-10 detik lalu refresh halaman dengan Ctrl + Shift + R.
--
-- b) Paksa lewat dashboard: Project Settings -> API -> tombol "Reload schema"
--    (kalau tersedia di versi dashboard Anda).
--
-- c) Terakhir: restart project (Settings -> General -> Restart project).
--    Ini mematikan koneksi sebentar, jadi lakukan hanya bila a dan b gagal.
