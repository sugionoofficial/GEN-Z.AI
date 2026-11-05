-- =====================================================================
-- cek-storage-detail.sql - jalankan di SQL Editor project TARGET (BARU)
-- =====================================================================
-- Dipakai bila verifikasi-storage.sql melaporkan jumlah objek TIDAK sama
-- dengan harapan. Berkas ini menunjukkan bucket mana yang berbeda dan
-- objek apa saja yang paling baru dibuat.
--
-- Satu statement (SQL Editor hanya menampilkan hasil query terakhir).
-- =====================================================================
with harapan(bucket_id, target) as (
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
    select bucket_id,
           count(*)::int as jumlah
      from storage.objects
     group by bucket_id
),
baris as (
    select h.bucket_id,
           h.target,
           coalesce(a.jumlah, 0) as hasil
      from harapan h
      left join ada a on a.bucket_id = h.bucket_id
),
terbaru as (
    select string_agg(
               bucket_id || ' / ' || name || '  [' || created_at::text || ']',
               ' || ' order by created_at desc
           ) as daftar
      from (
            select bucket_id, name, created_at
              from storage.objects
             order by created_at desc
             limit 5
           ) t
)
select 'bucket: ' || bucket_id as cek,
       hasil::text as hasil,
       target::text as target,
       case when hasil = target then 'OK'
            -- LEBIH = berkas baru sejak migrasi. Situs sudah berjalan, jadi ini
            -- wajar dan bukan tanda kegagalan.
            when hasil > target then 'LEBIH ' || (hasil - target) || ' (aktivitas baru)'
            -- KURANG = berkas proyek lama tidak ikut pindah. INI masalah.
            else 'KURANG ' || (target - hasil) || ' (PERIKSA)'
       end as status
  from baris
union all
select 'objek_5_terbaru',
       coalesce(daftar, '-'),
       '-',
       'lihat'
  from terbaru
 order by 1;
