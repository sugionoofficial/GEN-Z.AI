-- =====================================================================
-- rewrite-url-lama.sql — JALANKAN DI SQL EDITOR PROJECT BARU
--   rvgioyenjgkprnssfpfr
--
-- Mengganti setiap alamat project LAMA di dalam nilai teks menjadi alamat
-- project BARU, pada semua kolom teks di schema public:
--     https://ycovbqmezhrvzobxqnyp.supabase.co -> https://rvgioyenjgkprnssfpfr.supabase.co
--
-- URUTAN PEMAKAIAN (jangan dibalik):
--   1. migrasi/peta-url-lama.sql      (lihat kolom yang terdampak, READ-ONLY)
--   2. berkas ini                      (mengubah data)
--   3. jalankan LAGI migrasi/peta-url-lama.sql -> total_referensi harus 0
--      (atau langsung migrasi/verifikasi-url-baru.sql untuk rincian lengkap)
--   4. baru setelah langkah 3 menunjukkan 0, project lama boleh di-pause
--
-- CARA PAKAI: tempel SELURUH isi berkas ini ke SQL Editor, tekan Run.
-- Hasil yang diharapkan: "Success. No rows returned".
-- Itu normal — DO block tidak mengembalikan tabel. Angka hasilnya
-- ditampilkan oleh langkah 3.
--
-- KENAPA DO BLOCK, BUKAN SATU SELECT
--   Jumlah kolom yang memuat alamat lama belum diketahui pasti. DO block
--   bisa mengulang perintah UPDATE untuk setiap kolom secara dinamis, dan
--   tetap dihitung sebagai SATU statement — cocok dengan SQL Editor yang
--   hanya menampilkan hasil query terakhir.
--
-- KENAPA AMAN
--   - Seluruh perubahan berada dalam satu transaksi: kalau satu kolom
--     gagal, SEMUA dibatalkan, tidak ada keadaan setengah jadi.
--   - Syarat `like '%alamat-lama%'` membuat baris yang sudah ditulis ulang
--     tidak tersentuh lagi, jadi menjalankan ulang tidak merusak apa pun.
--   - Kolom terenkripsi (berawalan `encrypted_`) dan schema selain public
--     tidak disentuh. Nilai `supabase-private://...` memang tidak memuat
--     alamat project, jadi tidak berubah.
--
-- ⚠️ SEBELUM MENJALANKAN: pastikan Fase B (penyalinan storage) sudah
--    selesai. Rewrite hanya mengubah TEKS alamat; file-nya sendiri harus
--    sudah ada di bucket project baru.
-- =====================================================================

do $$
declare
    alamat_lama constant text := 'https://ycovbqmezhrvzobxqnyp.supabase.co';
    alamat_baru constant text := 'https://rvgioyenjgkprnssfpfr.supabase.co';
    pola_pencarian constant text := '%ycovbqmezhrvzobxqnyp%';
    kolom record;
    jumlah_baris bigint;
    total_baris bigint := 0;
    total_kolom integer := 0;
    ringkasan text := '';
begin
    for kolom in
        select c.table_name, c.column_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema
         and t.table_name = c.table_name
        where c.table_schema = 'public'
          and t.table_type = 'BASE TABLE'
          and c.data_type in ('text', 'character varying', 'character')
          and c.column_name not like 'encrypted\_%'
        order by c.table_name, c.column_name
    loop
        execute format(
            'update %I.%I set %I = replace(%I::text, %L, %L) where %I::text like %L',
            'public',
            kolom.table_name,
            kolom.column_name,
            kolom.column_name,
            alamat_lama,
            alamat_baru,
            kolom.column_name,
            pola_pencarian
        );

        get diagnostics jumlah_baris = row_count;

        if jumlah_baris > 0 then
            total_baris := total_baris + jumlah_baris;
            total_kolom := total_kolom + 1;
            ringkasan := ringkasan || format(
                E'\n  - public.%s.%s : %s baris',
                kolom.table_name,
                kolom.column_name,
                jumlah_baris
            );
            raise notice 'diubah: public.%.% -> % baris',
                kolom.table_name, kolom.column_name, jumlah_baris;
        end if;
    end loop;

    raise notice E'REWRITE SELESAI\n  total kolom : %\n  total baris : %\n  rincian : %',
        total_kolom, total_baris,
        case when ringkasan = '' then ' (tidak ada alamat lama yang ditemukan)' else ringkasan end;
end
$$;
