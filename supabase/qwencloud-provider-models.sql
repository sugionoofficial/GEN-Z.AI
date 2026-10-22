-- =========================================================
-- GEN-Z.AI
-- QWENCLOUD (ALIBABA CLOUD MODEL STUDIO / DASHSCOPE)
-- PROVIDER + 13 MODEL VIDEO
-- ---------------------------------------------------------
-- File:
--   supabase/qwencloud-provider-models.sql
--
-- Cara pakai:
--   1. Jalankan file ini di Supabase → SQL Editor.
--   2. Buka Admin Panel → Providers → QwenCloud → Isi API Key
--      (API key disimpan terenkripsi di provider_credentials).
--   3. Buka Admin Panel → Models untuk menyesuaikan credit
--      per resolusi sesuai harga jual kamu.
--
-- CATATAN CREDIT
--   Nilai credit di bawah adalah DEFAULT konservatif dan
--   dihitung untuk DURASI 5 DETIK (1 blok).
--
--   QwenCloud menagih per detik, jadi GEN-Z.AI mengalikan
--   credit secara otomatis:
--       5s = 1x   |   10s = 2x   |   15s = 3x
--   (lihat lib/generate/qwencloud-credit.js)
--
--   Contoh: wan2.6-t2v 720P = 30 credit
--       5s  -> 30 credit
--       10s -> 60 credit
--       15s -> 90 credit
--
--   Model tanpa parameter durasi (Wan Animate) selalu 1x.
--
--   Harga asli QwenCloud (Singapore):
--     wan2.6-t2v 720P  = $0.10 / detik
--     wan2.6-t2v 1080P = $0.15 / detik
--   Sesuaikan credit_480p / credit_720p / credit_1080p
--   dengan kurs credit GEN-Z.AI.
--
-- CATATAN KUOTA GRATIS QWENCLOUD
--   - Hanya berlaku di region SINGAPORE (key + endpoint).
--   - 90 hari sejak aktivasi akun / rilis model.
--   - Per model, tidak bisa digabung atau dipindah.
--   - Snapshot bertanggal (mis. wan2.6-t2v-2026-09-01)
--     punya kuota SENDIRI, terpisah dari wan2.6-t2v.
--   - Toggle "Free quota only" mencegah tagihan otomatis;
--     kalau kuota habis, request gagal dengan kode
--     AllocationQuota.FreeTierOnly (GEN-Z.AI menampilkan
--     pesan: "Kuota gratis model ini sudah habis...").
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
    'qwencloud',
    'QwenCloud',
    'Alibaba Cloud Model Studio (DashScope) — model video Wan 2.2 / 2.5 / 2.6.',
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
    where provider_id = 'qwencloud'
    limit 1
),
seed (model_id, model_name, description, min_duration, max_duration, supported_ratios, supported_resolutions, credit_480p, credit_720p, credit_1080p) as (
    values
        -- TEXT TO VIDEO -----------------------------------
        (
            'qwen-wan2.6-t2v',
            'Wan 2.6 Text to Video',
            'Text to video Wan 2.6 — 2–15 detik, 720P/1080P, dukungan audio input.',
            5, 15, '{16:9,9:16,1:1}', '{720P,1080P}', 20, 30, 50
        ),
        (
            'qwen-wan2.5-t2v-preview',
            'Wan 2.5 Text to Video (Preview)',
            'Text to video Wan 2.5 preview — 480P/720P/1080P, audio input.',
            5, 10, '{16:9,9:16,1:1}', '{720P,480P,1080P}', 18, 28, 45
        ),
        (
            'qwen-wan2.2-t2v-plus',
            'Wan 2.2 Text to Video Plus',
            'Text to video Wan 2.2 Plus — durasi tetap 5 detik.',
            5, 5, '{16:9,9:16,1:1}', '{720P,1080P}', 15, 25, 40
        ),

        -- IMAGE TO VIDEO (FIRST FRAME) --------------------
        (
            'qwen-wan2.6-i2v-flash',
            'Wan 2.6 Image to Video Flash',
            'Image to video cepat dari Wan 2.6 — 720P/1080P.',
            5, 10, '{}', '{720P,1080P}', 20, 28, 45
        ),
        (
            'qwen-wan2.6-i2v',
            'Wan 2.6 Image to Video',
            'Image to video Wan 2.6 kualitas penuh — 720P/1080P.',
            5, 10, '{}', '{720P,1080P}', 22, 32, 55
        ),
        (
            'qwen-wan2.5-i2v-preview',
            'Wan 2.5 Image to Video (Preview)',
            'Image to video Wan 2.5 preview — 480P/720P/1080P.',
            5, 10, '{}', '{720P,480P,1080P}', 18, 28, 48
        ),
        (
            'qwen-wan2.2-i2v-flash',
            'Wan 2.2 Image to Video Flash',
            'Image to video Wan 2.2 Flash — cepat dan hemat.',
            5, 5, '{}', '{720P,480P}', 12, 20, 28
        ),
        (
            'qwen-wan2.2-i2v-plus',
            'Wan 2.2 Image to Video Plus',
            'Image to video Wan 2.2 Plus — kualitas lebih tinggi.',
            5, 5, '{}', '{720P,1080P}', 22, 28, 45
        ),

        -- KEYFRAME ---------------------------------------
        (
            'qwen-wan2.2-kf2v-flash',
            'Wan 2.2 First & Last Frame',
            'Video transisi dari frame awal ke frame akhir.',
            5, 5, '{}', '{720P,480P,1080P}', 15, 25, 40
        ),

        -- REFERENCE TO VIDEO ------------------------------
        (
            'qwen-wan2.6-r2v-flash',
            'Wan 2.6 Reference to Video Flash',
            'Konsistensi karakter dari gambar/video referensi — versi flash.',
            5, 10, '{16:9,9:16,1:1}', '{720P,1080P}', 22, 32, 50
        ),
        (
            'qwen-wan2.6-r2v',
            'Wan 2.6 Reference to Video',
            'Konsistensi karakter dari gambar/video referensi — kualitas penuh.',
            5, 10, '{16:9,9:16,1:1}', '{720P,1080P}', 30, 40, 65
        ),

        -- WAN ANIMATE -------------------------------------
        (
            'qwen-wan2.2-animate-move',
            'Wan 2.2 Animate Move',
            'Animasi karakter mengikuti gerakan video referensi (mode wan-std / wan-pro).',
            0, 0, '{}', '{}', 35, 35, 35
        ),
        (
            'qwen-wan2.2-animate-mix',
            'Wan 2.2 Animate Mix',
            'Ganti karakter pada video referensi dengan gambar karakter (mode wan-std / wan-pro).',
            0, 0, '{}', '{}', 35, 35, 35
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
    seed.min_duration,
    seed.max_duration,
    seed.supported_ratios,
    seed.supported_resolutions,
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
    supported_resolutions = excluded.supported_resolutions;


-- =========================================================
-- 3. VERIFIKASI
-- =========================================================

-- select provider_id, model_id, model_name, status
-- from public.models
-- where provider_id = (select id from public.providers where provider_id = 'qwencloud')
-- order by model_id;
