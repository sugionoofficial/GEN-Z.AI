-- =====================================================================
-- verifikasi-url-baru.sql — JALANKAN SETELAH rewrite-url-lama.sql
--   di SQL Editor project baru: rvgioyenjgkprnssfpfr
--
-- Membuktikan tiga hal dalam SATU query (SQL Editor hanya menampilkan
-- hasil query terakhir):
--   1. Tidak ada lagi alamat project lama di schema public.
--   2. Alamat project baru benar-benar terpasang.
--   3. Rincian per kolom, agar cocok dengan angka sebelum rewrite.
--
-- Target lulus:
--   sisa_url_lama = 0, referensi_url_baru > 0, kesimpulan = BERSIH
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
      and (
            c.data_type in ('text', 'character varying', 'character')
            or c.udt_name in ('text', 'varchar', 'bpchar', 'citext')
          )
      and c.column_name not like 'encrypted\_%'
),
hitung as (
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
        )[1]::text::bigint as lama,
        (
            xpath('/row/n/text()', query_to_xml(
                format(
                    'select count(*) as n from %I.%I where %I::text like %L',
                    'public', k.table_name, k.column_name, '%rvgioyenjgkprnssfpfr%'
                ),
                false, true, ''
            ))
        )[1]::text::bigint as baru
    from kolom_teks k
)
select
    coalesce(sum(lama), 0) as sisa_url_lama,
    coalesce(sum(baru), 0) as referensi_url_baru,
    count(*) filter (where coalesce(baru, 0) > 0) as kolom_terisi_url_baru,
    coalesce(
        string_agg(
            format('%s.%s (baru: %s)', table_name, column_name, baru),
            ', ' order by baru desc, table_name, column_name
        ) filter (where coalesce(baru, 0) > 0),
        '(belum ada)'
    ) as rincian,
    case
        when coalesce(sum(lama), 0) = 0 and coalesce(sum(baru), 0) > 0
            then 'BERSIH — aman lanjut pause project lama'
        when coalesce(sum(lama), 0) = 0
            then 'TIDAK ADA URL APA PUN — periksa apakah Fase B storage benar-benar menyalin file'
        else 'MASIH ADA URL LAMA — jalankan rewrite-url-lama.sql dulu'
    end as kesimpulan
from hitung;
