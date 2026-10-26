-- =========================================================
-- GEN-Z.AI
-- TENCENT AI ART — IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
-- PROVIDER + MODEL + IZIN BACA HASIL
-- ---------------------------------------------------------
-- File:
--   supabase/tencent-aiart-provider-models.sql
--
-- Cara pakai:
--   1. Buka Supabase → SQL Editor → tempel isi file ini →
--      Run. File ini IDEMPOTENT (aman dijalankan ulang).
--   2. Buka Admin Panel → Providers → Tencent AI Art →
--      isi kredensial:
--          SecretId|SecretKey
--      (SecretId dan SecretKey dari Tencent Cloud → CAM →
--      API Keys. Ini BUKAN TokenHub key.)
--   3. Buka Admin Panel → Models → Tencent AI Art —
--      sesuaikan credit / status bila perlu.
--
-- KENAPA PERLU DUA TABEL
--   `/api/model-config` membaca model dari tabel
--   `public.models`. Tanpa baris di sini, halaman Generate
--   menolak dengan "Model is not configured" walaupun
--   adapter sudah terdaftar di kode.
--
-- KENAPA `supported_resolutions` DIBIARKAN KOSONG
--   Model ini menjual SATU kredit rata (flat credit):
--   tidak ada pilihan resolusi di form. Kode
--   api/model-config.js menganggap array kosong =
--   flat_credit (sama seperti Kling Motion Control),
--   sehingga credit diambil dari `credit_480p`.
--
-- PERKIRAAN HARGA
--   Tencent AI Art menagih per gambar (ImageToImage).
--   Default 5 credit di bawah adalah tebakan konservatif;
--   silakan ubah di Admin Panel → Models sesuai harga jual.
--
-- CATATAN HASIL GAMBAR
--   Tencent membalas base64/URL yang hanya berlaku 1 jam,
--   jadi Worker menyimpan hasilnya ke bucket privat
--   `user-uploads` pada prefix:
--       aiart-outputs/<user-id>/<waktu>-<acak>.<ext>
--   Bagian 3 di bawah memperbarui policy Supabase supaya
--   user bisa membuat signed URL untuk hasilnya sendiri.
-- =========================================================


-- =========================================================
-- 1. PROVIDER
-- =========================================================

insert into public.providers (
    provider_id,
    provider_name,
    description,
    status,
    is_default
)
values (
    'tencent-aiart',
    'Tencent AI Art',
    'Tencent Cloud AI Art (图像风格化 / 图生图) — mengubah foto asli menjadi gambar bergaya anime, kartun, guofeng, 3D, dan lainnya.',
    'active',
    false
)
on conflict (provider_id) do update
set
    provider_name = excluded.provider_name,
    description = excluded.description;


-- =========================================================
-- 2. MODEL
--    provider_id mengacu ke public.providers.id (uuid)
-- =========================================================

with provider as (
    select id
    from public.providers
    where provider_id = 'tencent-aiart'
    limit 1
),
seed (model_id, model_name, description, credit) as (
    values (
        'tencent-aiart-image-to-image',
        'Tencent AI Art — Foto jadi Anime',
        'Ubah foto asli menjadi gambar anime/kartun/gaya lain memakai Tencent AI Art (ImageToImage). Wajib unggah 1 foto; prompt opsional.',
        5
    )
)
insert into public.models (
    provider_id,
    model_id,
    model_name,
    description,
    min_duration,
    max_duration,
    supported_ratios,
    supported_resolutions,
    credit_480p,
    credit_720p,
    credit_1080p,
    discount_percent,
    status
)
select
    provider.id,
    seed.model_id,
    seed.model_name,
    seed.description,
    0,
    0,

    /*
     * WAJIB cast ke text[] — literal '{}' di CTE bertipe
     * text, bukan text[] (lihat catatan yang sama di
     * supabase/qwencloud-provider-models.sql).
     */

    '{}'::text[],
    '{}'::text[],

    /*
     * Flat credit: dibaca dari credit_480p karena tidak ada
     * resolusi. credit_720p / credit_1080p dikosongkan
     * supaya tidak ada angka menyesatkan di panel admin.
     */

    seed.credit,
    null,
    null,
    0,
    'active'
from seed
cross join provider
on conflict (provider_id, model_id) do update
set
    model_name = excluded.model_name,
    description = excluded.description,
    min_duration = excluded.min_duration,
    max_duration = excluded.max_duration,
    supported_ratios = excluded.supported_ratios,
    supported_resolutions = excluded.supported_resolutions;


-- =========================================================
-- 3. IZIN BACA HASIL AI ART (bucket privat `user-uploads`)
--    -----------------------------------------------------
--    Mengganti fungsi dari supabase/user-media-bucket.sql
--    dengan tambahan prefix `aiart-outputs`.
--
--    Tanpa bagian ini, halaman History tidak bisa membuat
--    signed URL untuk hasil AI Art (RLS menolak), sehingga
--    hasilnya tampak kosong padahal file-nya ada.
-- =========================================================

create or replace function public.user_owns_media_path(object_name text)
returns boolean
language sql
stable
as $$
    select coalesce(
        object_name ~ (
            '^(generate-input|upscale-photos/inputs|upscale-videos/inputs'
            '|upscale-photos/outputs|upscale-videos/outputs|aiart-outputs)/'
            || auth.uid()::text
            || '/([A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+$'
        ),
        false
    );
$$;


-- Hasil AI Art hanya dibuat server (service role), jadi user
-- tidak diberi izin INSERT/DELETE untuk prefix ini — cukup
-- SELECT lewat fungsi di atas.


-- =========================================================
-- 4. VERIFIKASI
-- =========================================================

-- select p.provider_id, m.model_id, m.model_name, m.status,
--        m.supported_resolutions, m.credit_480p
-- from public.models m
-- join public.providers p on p.id = m.provider_id
-- where p.provider_id = 'tencent-aiart';
