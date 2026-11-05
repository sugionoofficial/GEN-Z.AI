-- =====================================================================
-- 01-export-fingerprint.sql
-- "Sidik jari" data proyek SUMBER `ycovbqmezhrvzobxqnyp` (ap-southeast-1).
--
-- Jalankan di SQL Editor proyek SUMBER -> satu hasil JSON (baris tunggal).
-- Simpan hasilnya sebagai backup/fingerprint-source.json SEBELUM migrasi,
-- lalu jalankan 03-verify-target.sql di proyek TARGET setelah restore.
-- Bila semua angka + checksum sama, restore terbukti utuh.
--
-- ⚠️ HASIL QUERY INI RAHASIA. Ia memuat md5 isi baris, termasuk
-- `provider_credentials` dan `free_credit_secret_config` (API key provider +
-- password pepper). Simpan hasilnya HANYA di `supabase/backup/` (sudah
-- di-.gitignore) atau di komputer sendiri. JANGAN ditempel ke chat, issue,
-- atau PR — repo ini publik.
--
-- Kenapa perlu: `pg_dump`/`psql` bisa selesai tanpa error tetapi baris tetap
-- hilang (RLS menolak insert, FK gagal ditelan `ON ERROR`). Row count saja
-- tidak cukup karena baris bisa tertukar; karena itu tiap tabel diberi
-- checksum md5 atas baris yang sudah diurutkan (tidak bergantung urutan fisik).
--
-- Pemakaian: jalankan di SUMBER sebelum backup, simpan hasilnya, lalu jalankan
-- query yang sama di TARGET setelah restore. Bandingkan — harus identik.
-- Untuk pemeriksaan cepat yang aman di-commit, pakai `migrasi/verify-restore.sql`.
--
-- Trik `h::text`: alias tabel yang di-cast ke text menghasilkan literal
-- composite untuk SELURUH baris, jadi checksum tidak perlu tahu nama kolom.
-- =====================================================================

with tabel as (
  select c.oid, n.nspname as sch, c.relname as tbl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
),
statistik as (
  select
    t.tbl,
    (xpath('/row/n/text()', query_to_xml(
       format('select count(*) as n from %I.%I', t.sch, t.tbl),
       false, true, '')))[1]::text::bigint as baris,
    (xpath('/row/c/text()', query_to_xml(
       format('select coalesce(md5(string_agg(h::text, ''|'' order by h::text)), ''kosong'') as c from %I.%I h',
              t.sch, t.tbl),
       false, true, '')))[1]::text as checksum
  from tabel t
)
select jsonb_pretty(jsonb_build_object(
  'project', 'ycovbqmezhrvzobxqnyp',
  'diambil_pada', now(),
  'jumlah_tabel_public', (select count(*) from tabel),
  'total_baris_public',  (select coalesce(sum(baris), 0) from statistik),
  'auth', jsonb_build_object(
     'users',      (select count(*) from auth.users),
     'identities', (select count(*) from auth.identities)
  ),
  'storage', jsonb_build_object(
     'buckets', (select count(*) from storage.buckets),
     'objects', (select count(*) from storage.objects)
  ),
  'objek_db', jsonb_build_object(
     'tabel_rls_aktif', (select count(*) from pg_tables where schemaname = 'public' and rowsecurity),
     'policy',          (select count(*) from pg_policies where schemaname = 'public'),
     'trigger',         (select count(*) from pg_trigger t
                         join pg_class c on c.oid = t.tgrelid
                         join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and not t.tgisinternal),
     'fungsi',          (select count(*) from pg_proc p
                         join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public'),
     'sequence',        (select count(*) from pg_sequences where schemaname = 'public')
  ),
  'per_tabel', (
     select jsonb_object_agg(tbl, jsonb_build_object('baris', baris, 'md5', checksum) order by tbl)
     from statistik
  )
)) as fingerprint;
