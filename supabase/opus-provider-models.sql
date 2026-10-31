-- =========================================================
-- GEN-Z.AI
-- OPUS LABS (OPUS VIDEO TOOLS MCP)
-- PROVIDER + 6 MODEL VIDEO
-- ---------------------------------------------------------
-- File:
--   supabase/opus-provider-models.sql
--
-- Cara pakai:
--   1. Jalankan file ini di Supabase → SQL Editor.
--      (File ini idempotent: aman dijalankan berulang.)
--   2. Kredensial Opus diambil otomatis dari secret Worker
--      (`OPUS_AUTH_TOKEN` / `OPUS_REFRESH_TOKEN`), atau dapat
--      dioverride lewat Admin Panel → Providers → Opus → API Key.
--   3. Buka Admin Panel → Models untuk menyesuaikan credit
--      per resolusi sesuai harga jual GEN-Z.AI.
--
-- CATATAN CREDIT
--   Nilai credit di bawah dipotong FLAT (1x) per generasi sesuai
--   angka resolusi yang diatur Admin pada halaman Edit Model
--   (tidak dikalikan durasi detik video).
--   Untuk MiniMax Hailuo 3:
--     - Resolusi 768p menggunakan slot `credit_720p`
--     - Resolusi 2K   menggunakan slot `credit_1080p`
--   PENTING: Di sisi upstream Opus Labs (`generate_video_clips`),
--   saldo akun OpusClip tetap dipotong oleh Opus sesuai durasi video.
-- =========================================================

-- =========================================================
-- 0. KOLOM OPSIONAL DURASI PILIHAN (IDEMPOTENT)
-- =========================================================

alter table public.models
    add column if not exists supported_durations text[];


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
    'opus',
    'Opus',
    'Opus Labs Video Tools MCP — model video Seedance 2.5, Seedance 2.0, dan MiniMax Hailuo 3.',
    'active',
    false
)
on conflict (provider_id) do update
set
    provider_name = excluded.provider_name,
    description = excluded.description,
    status = excluded.status;


-- =========================================================
-- 2. MODEL VIDEO
--    provider_id mengacu ke public.providers.id (uuid)
-- =========================================================

with provider as (
    select id
    from public.providers
    where provider_id = 'opus'
    limit 1
),
seed (
    model_id,
    model_name,
    description,
    min_duration,
    max_duration,
    supported_ratios,
    supported_resolutions,
    supported_durations,
    credit_480p,
    credit_720p,
    credit_1080p
) as (
    values
        -- SEEDANCE 2.5 ------------------------------------
        (
            'opus-seedance-2.5-t2v',
            'Seedance 2.5 Text to Video (Opus)',
            'Text to video Seedance 2.5 via Opus Labs — 4–30 detik, 480p/720p, dukungan audio dialog & musik bawaan.',
            4, 30, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{720p,480p}', '{4,5,8,10,12,15,20,25,30}', 15, 25, 0
        ),
        (
            'opus-seedance-2.5-i2v',
            'Seedance 2.5 Image to Video (Opus)',
            'Image to video Seedance 2.5 dari gambar frame awal via Opus Labs — 4–30 detik, 480p/720p, audio bawaan.',
            4, 30, '{}', '{720p,480p}', '{4,5,8,10,12,15,20,25,30}', 15, 25, 0
        ),
        (
            'opus-seedance-2.5-r2v',
            'Seedance 2.5 Reference to Video (Opus)',
            'Konsistensi karakter, gerakan, suara & produk dari hingga 3 gambar referensi (@image1–@image3), 3 video referensi (@video1–@video3), dan/atau audio referensi (@audio1) via Opus Labs — 4–30 detik.',
            4, 30, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{720p,480p}', '{4,5,8,10,12,15,20,25,30}', 18, 28, 0
        ),
        (
            'opus-seedance-2.5-r2v-30s',
            'Seedance 2.5 Reference to Video (30s)',
            'Video 30 detik bertahap (3 × 10 detik tersambung mulus dari frame akhir tiap klip) dari hingga 3 gambar (@image1–@image3), 3 video (@video1–@video3), dan/atau audio referensi (@audio1) via Opus Labs.',
            30, 30, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{480p,720p}', '{30}', 6000, 7500, 0
        ),

        -- SEEDANCE 2.0 ------------------------------------
        (
            'opus-seedance-2.0-r2v',
            'Seedance 2.0 Video (Opus)',
            'Text & Reference to video Seedance 2.0 via Opus Labs — 4–15 detik, opsional hingga 3 gambar referensi (@image1–@image3), 3 video referensi (@video1–@video3), & audio referensi (@audio1).',
            4, 15, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{720p,480p}', '{4,5,8,10,12,15}', 12, 20, 0
        ),

        -- MINIMAX HAILUO 3 --------------------------------
        (
            'opus-hailuo-3-t2v',
            'MiniMax Hailuo 3 Text to Video (Opus)',
            'Text to video MiniMax Hailuo 3 via Opus Labs — 5–15 detik, resolusi tajam 768p & 2K.',
            5, 15, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{768p,2k}', '{5,6,8,10,12,15}', 0, 25, 45
        ),
        (
            'opus-hailuo-3-i2v',
            'MiniMax Hailuo 3 First & Last Frame (Opus)',
            'Image to video MiniMax Hailuo 3 dari frame awal + frame akhir opsional via Opus Labs — 5–15 detik, 768p & 2K.',
            5, 15, '{}', '{768p,2k}', '{5,6,8,10,12,15}', 0, 25, 45
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
    supported_durations,
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
    seed.min_duration,
    seed.max_duration,
    seed.supported_ratios::text[],
    seed.supported_resolutions::text[],
    seed.supported_durations::text[],
    seed.credit_480p,
    seed.credit_720p,
    seed.credit_1080p,
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
    supported_resolutions = excluded.supported_resolutions,
    supported_durations = coalesce(public.models.supported_durations, excluded.supported_durations);
