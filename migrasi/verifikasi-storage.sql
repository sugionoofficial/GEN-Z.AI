-- =====================================================================
-- verifikasi-storage.sql - jalankan di SQL Editor project TARGET (BARU)
-- =====================================================================
-- Dipakai SETELAH Fase B (migrate_bulk.mjs) untuk memastikan 112 file
-- benar-benar mendarat di project baru. Skrip itu mencetak "112 diupload,
-- 0 gagal", tetapi angka di layar bukan bukti — yang membuktikan adalah
-- baris di storage.objects.
--
-- Satu statement saja, karena SQL Editor Supabase hanya menampilkan hasil
-- query terakhir bila ada beberapa pernyataan.
-- =====================================================================
with harapan(bucket_id, jumlah) as (
    values ('user-uploads', 47),
           ('social-character-references', 45),
           ('dashboard-videos', 19),
           ('social-story-audio', 1),
           ('dashboard-upscales', 0),
           ('topup-proofs', 0),
           ('topup-payment-assets', 0),
           ('site-announcements', 0)
),
ada as (
    select b.id as bucket_id,
           count(o.id)::int as jumlah
      from storage.buckets b
      left join storage.objects o on o.bucket_id = b.id
     group by b.id
),
rinci as (
    select h.bucket_id,
           h.jumlah as target,
           coalesce(a.jumlah, 0) as hasil
      from harapan h
      left join ada a on a.bucket_id = h.bucket_id
    union all
    -- Bucket yang ada di project baru tapi tidak ada di daftar harapan.
    select a.bucket_id, 0, a.jumlah
      from ada a
     where a.bucket_id not in (select bucket_id from harapan)
),
ringkas as (
    select count(*) as jumlah_bucket,
           coalesce(sum(target), 0) as total_target,
           coalesce(sum(hasil), 0) as total_hasil,
           count(*) filter (where hasil <> target) as bucket_beda
      from rinci
)
select no, cek, hasil, target,
       case
           when target = 'bebas' then 'INFO'
           when hasil = target then 'OK'
           -- Kelebihan objek hanya mungkin terjadi karena aktivitas baru.
           when no in (1, 4) and hasil > target then 'OK (bertambah)'
           else 'PERIKSA'
       end as status
  from (
        select 1 as no,
               'total_objek_semua_bucket' as cek,
               r.total_hasil::text as hasil,
               r.total_target::text as target
          from ringkas r
        union all
        select 2, 'jumlah_bucket',
               r.jumlah_bucket::text, '8'
          from ringkas r
        union all
        select 3, 'bucket_dengan_selisih',
               r.bucket_beda::text, '0'
          from ringkas r
        union all
        select 4, 'objek_kehilangan_owner',
               (select count(*)::text
                  from storage.objects
                 where owner is null and owner_id is null), '0'
        union all
        select 5, 'objek_tanpa_metadata_ukuran',
               (select count(*)::text
                  from storage.objects
                 where metadata is null
                    or (metadata ->> 'size') is null), '0'
        union all
        select 6, 'objek_berukuran_nol',
               (select count(*)::text
                  from storage.objects
                 where coalesce((metadata ->> 'size')::bigint, 0) = 0), '0'
        union all
        -- Situs SUDAH BERJALAN, jadi jumlah objek akan bertambah setiap kali
        -- pengguna mengunggah atau meng-upscale. Baris ini hanya INFORMASI:
        -- kelebihan objek berarti aktivitas baru, bukan kegagalan salin.
        -- Yang berbahaya adalah KURANG dari 112 — itu berarti ada berkas dari
        -- proyek lama yang tidak ikut pindah.
        select 7, 'kelebihan_objek_adalah_aktivitas_baru',
               greatest(r.total_hasil - 112, 0)::text, 'bebas'
       ) t
 order by no;
