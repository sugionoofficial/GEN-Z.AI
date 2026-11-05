-- =====================================================================
-- peta-url-lama.sql — JALANKAN DI SQL EDITOR PROJECT BARU
--   rvgioyenjgkprnssfpfr
--
-- READ-ONLY. Tidak mengubah apa pun.
--
-- Tujuan: menemukan SETIAP kolom teks di schema public yang memuat
-- jejak project lama (ycovbqmezhrvzobxqnyp), beserta jumlah baris dan
-- jumlah kemunculannya.
--
-- ⚠️ REVISI PENTING
--   Versi pertama hanya memeriksa `data_type in ('text','character
--   varying','character')`. Ternyata kolom bertipe padat (`character(n)`
--   / bpchar) tidak tertangkap oleh daftar itu di beberapa konfigurasi,
--   sehingga sisa 4 baris lolos dari pemetaan. Versi ini memakai
--   `udt_name` juga, jadi SEMUA kolom berbasis teks ikut diperiksa.
--
-- Keluaran:
--   total_referensi   = jumlah kemunculan jejak lama di semua kolom
--   total_baris       = jumlah BARIS yang memuat jejak lama
--   total_kolom       = jumlah kolom yang terdampak
--   rincian           = "tabel.kolom (N baris, M kemunculan)"
-- =====================================================================

with kolom_teks as (
    select
        c.table_name,
        c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      -- Semua bentuk kolom teks: text, varchar, character(n), citext.
      and (
            c.data_type in ('text', 'character varying', 'character')
            or c.udt_name in ('text', 'varchar', 'bpchar', 'citext')
          )
      and c.column_name not like 'encrypted\_%'
),
per_kolom as (
    select
        k.table_name,
        k.column_name,
        (
            xpath('/row/n/text()', query_to_xml(
                format(
                    'select count(*) as n from %I.%I where %I::text like %L',
                    'public', k.table_name, k.column_name, '%ycovbqmezhrvzobxqnyp%'
                ),
                false, true, ''
            ))
        )[1]::text::bigint as baris,
        (
            xpath('/row/n/text()', query_to_xml(
                format(
                    'select coalesce(sum((length(%I::text) - length(replace(%I::text, %L, %L))) / length(%L)), 0) as n
                       from %I.%I
                      where %I::text like %L',
                    k.column_name,
                    k.column_name,
                    'ycovbqmezhrvzobxqnyp',
                    '',
                    'ycovbqmezhrvzobxqnyp',
                    'public', k.table_name,
                    k.column_name,
                    '%ycovbqmezhrvzobxqnyp%'
                ),
                false, true, ''
            ))
        )[1]::text::bigint as kemunculan
    from kolom_teks k
),
temuan as (
    select * from per_kolom where coalesce(baris, 0) > 0
)
select
    (select coalesce(sum(kemunculan), 0) from temuan) as total_referensi,
    (select coalesce(sum(baris), 0) from temuan)      as total_baris,
    (select count(*) from temuan)                     as total_kolom,
    coalesce(
        (
            select string_agg(
                       format('%s.%s (%s baris, %s kemunculan)',
                              table_name, column_name, baris, kemunculan),
                       ', ' order by baris desc, table_name, column_name
                   )
            from temuan
        ),
        '(tidak ada jejak project lama)'
    )                                                 as rincian;
