-- =====================================================================
-- rewrite-url-lama.sql — JALANKAN DI SQL EDITOR PROJECT BARU
--   rvgioyenjgkprnssfpfr
--
-- Mengganti setiap jejak project LAMA di dalam nilai teks menjadi
-- project BARU, pada semua kolom teks di schema public:
--     ycovbqmezhrvzobxqnyp  ->  rvgioyenjgkprnssfpfr
--
-- URUTAN PEMAKAIAN (jangan dibalik):
--   1. migrasi/peta-url-lama.sql       lihat kolom yang terdampak (read-only)
--   2. BERKAS INI                      mengubah data
--   3. migrasi/verifikasi-url-baru.sql buktikan sudah bersih
--   4. baru setelah langkah 3 menunjukkan sisa_url_lama = 0,
--      project lama boleh di-Pause
--
-- CARA PAKAI: tempel SELURUH isi berkas ini ke SQL Editor, tekan Run.
-- Hasil "Success. No rows returned" itu NORMAL — DO block tidak
-- mengembalikan tabel. Angka hasilnya dibaca di langkah 3.
--
-- KENAPA AMAN
--   - Satu transaksi: bila satu kolom gagal, SEMUA dibatalkan.
--   - Disaring LIKE '%ycovbqmezhrvzobxqnyp%', jadi baris yang sudah
--     bersih tidak tersentuh lagi — aman dijalankan berulang.
--   - Kolom terenkripsi (encrypted_*) dan schema selain public dilewati.
--   - Tidak ada delete/drop/truncate.
-- =====================================================================

do $$
declare
    jejak_lama constant text := 'ycovbqmezhrvzobxqnyp';
    jejak_baru constant text := 'rvgioyenjgkprnssfpfr';
    pola_pencarian constant text := '%ycovbqmezhrvzobxqnyp%';
    kolom record;
    jumlah_baris bigint;
    total_baris bigint := 0;
    total_kolom integer := 0;
    ringkasan text := '';
begin
    for kolom in
        select
            c.table_name,
            c.column_name,
            -- tipe asli kolom, supaya bpchar/varchar(n) tidak terpotong
            (
                select format_type(a.atttypid, a.atttypmod)
                from pg_attribute a
                where a.attrelid = format('%I.%I', c.table_schema, c.table_name)::regclass
                  and a.attname = c.column_name
                  and not a.attisdropped
            ) as tipe
        from information_schema.columns c
        where c.table_schema = 'public'
          and exists (
                select 1
                from information_schema.tables t
                where t.table_schema = c.table_schema
                  and t.table_name = c.table_name
                  and t.table_type = 'BASE TABLE'
          )
          and (
                c.data_type in ('text', 'character varying', 'character')
                or c.udt_name in ('text', 'varchar', 'bpchar', 'citext')
              )
          and c.column_name not like 'encrypted\_%'
        order by c.table_name, c.column_name
    loop
        execute format(
            'update %I.%I set %I = replace(%I::text, %L, %L)::%s where %I::text like %L',
            'public',
            kolom.table_name,
            kolom.column_name,
            kolom.column_name,
            jejak_lama,
            jejak_baru,
            kolom.tipe,
            kolom.column_name,
            pola_pencarian
        );

        get diagnostics jumlah_baris = row_count;

        if jumlah_baris > 0 then
            total_baris := total_baris + jumlah_baris;
            total_kolom := total_kolom + 1;
            ringkasan := ringkasan || format(
                E'\n  - public.%s.%s (%s) : %s baris',
                kolom.table_name,
                kolom.column_name,
                kolom.tipe,
                jumlah_baris
            );
            raise notice 'diubah: public.%.% (%) -> % baris',
                kolom.table_name, kolom.column_name, kolom.tipe, jumlah_baris;
        end if;
    end loop;

    raise notice E'REWRITE SELESAI\n  total kolom : %\n  total baris : %\n  rincian : %',
        total_kolom,
        total_baris,
        case
            when ringkasan = '' then ' (tidak ada jejak project lama yang ditemukan)'
            else ringkasan
        end;
end
$$;
