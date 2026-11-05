-- =====================================================================
-- peta-url-lama.sql — JALANKAN DI SQL EDITOR PROJECT BARU
--   rvgioyenjgkprnssfpfr
--
-- Tujuan: menemukan SETIAP kolom di schema public yang masih memuat
-- alamat project lama, beserta jumlah barisnya. Query ini READ-ONLY —
-- tidak mengubah apa pun.
--
-- Kenapa perlu: perkiraan awal hanya menyebut dua kolom
-- (result_url, image_reference_url). Kalau ternyata ada kolom lain yang
-- juga menyimpan alamat project lama, melewatinya berarti media rusak
-- SETELAH project lama di-pause dan tidak bisa diperbaiki lagi.
--
-- PENTING: SQL Editor Supabase hanya menampilkan hasil query TERAKHIR,
-- jadi seluruh pemeriksaan digabung menjadi SATU statement.
--
-- Keluaran kolom `temuan`:
--   total_referensi = jumlah kemunculan alamat lama di SEMUA kolom teks
--   total_kolom     = berapa kolom yang terdampak
--   rincian         = daftar "tabel.kolom (jumlah baris)" di dalam satu sel
-- =====================================================================

with kolom_teks as (
    select
        c.table_schema,
        c.table_name,
        c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'character')
      and c.column_name not like 'encrypted_%'
),
hitung as (
    select
        k.table_name,
        k.column_name,
        (
            xpath(
                '/row/n/text()',
                query_to_xml(
                    format(
                        'select count(*) as n from %I.%I where %I::text like %L',
                        k.table_schema,
                        k.table_name,
                        k.column_name,
                        '%ycovbqmezhrvzobxqnyp%'
                    ),
                    false,
                    true,
                    ''
                )
            )
        )[1]::text::bigint as baris
    from kolom_teks k
),
temuan as (
    select * from hitung where coalesce(baris, 0) > 0
)
select
    (select coalesce(sum(baris), 0) from temuan) as total_referensi,
    (select count(*) from temuan)                as total_kolom,
    (
        select string_agg(
                   format('%s.%s (%s baris)', table_name, column_name, baris),
                   ', ' order by baris desc, table_name, column_name
               )
        from temuan
    )                                            as rincian;
