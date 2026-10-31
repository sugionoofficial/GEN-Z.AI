-- =========================================================
-- GEN-Z.AI — STAGED 30-SECOND VIDEO PIPELINE (3 x 10 DETIK)
-- ---------------------------------------------------------
-- File:
--   supabase/staged-video-30s.sql
--
-- Menyediakan:
--   1. Tabel `public.staged_generation_jobs` untuk melacak
--      Klip 1 (0-10s), Klip 2 (11-20s), Klip 3 (21-30s),
--      penyimpanan tiap klip di server, frame akhir antar klip,
--      hasil gabungan mulus 30 detik, serta settlement kredit.
--   2. Pendaftaran model clone `opus-seedance-2.5-r2v-30s`
--      ("Seedance 2.5 Reference to Video (30s)") dengan tarif
--      awal 480p = 6.000 kredit dan 720p = 7.500 kredit.
-- =========================================================

create table if not exists public.staged_generation_jobs (
    id uuid primary key default gen_random_uuid(),
    task_id text not null unique,
    history_id uuid not null references public.generation_history(id) on delete cascade,
    user_id uuid not null,
    model_id text not null default 'opus-seedance-2.5-r2v-30s',
    status text not null default 'processing',
    current_stage text not null default 'clip_1_generating',
    stage_message text,
    internal_token text,
    request_payload jsonb not null default '{}'::jsonb,
    clip_1_task_id text,
    clip_1_storage_ref text,
    clip_1_last_frame_ref text,
    clip_2_task_id text,
    clip_2_storage_ref text,
    clip_2_last_frame_ref text,
    clip_3_task_id text,
    clip_3_storage_ref text,
    merged_storage_ref text,
    completed_clips integer not null default 0,
    final_duration_seconds integer,
    credit_total numeric not null default 0,
    credit_charged numeric not null default 0,
    credit_refunded_amount numeric not null default 0,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_staged_generation_jobs_history_id
    on public.staged_generation_jobs (history_id);

create index if not exists idx_staged_generation_jobs_user_status
    on public.staged_generation_jobs (user_id, status);

-- RLS aktif tanpa policy anon/authenticated sehingga hanya service_role
-- (Cloudflare Worker & GitHub Actions server orchestrator) yang dapat
-- membaca/menulis `internal_token` dan state internal job.
alter table public.staged_generation_jobs enable row level security;

revoke all on public.staged_generation_jobs from anon, authenticated;
grant all on public.staged_generation_jobs to service_role;

-- Daftarkan / sinkronkan model clone 30 detik pada provider Opus
with provider as (
    select id
    from public.providers
    where provider_id = 'opus'
    limit 1
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
    'opus-seedance-2.5-r2v-30s',
    'Seedance 2.5 Reference to Video (30s)',
    'Video 30 detik utuh secara bertahap (3 × 10 detik tersambung mulus dari frame akhir tiap klip) menggunakan hingga 3 gambar (@image1–@image3), 3 video (@video1–@video3), dan/atau audio referensi (@audio1). Mendukung prompt berdurasi (0-10, 11-20, 21-30) maupun otomatis.',
    30,
    30,
    '{9:16,16:9,1:1,4:3,3:4,21:9}'::text[],
    '{480p,720p}'::text[],
    '{30}'::text[],
    6000,
    7500,
    0,
    0,
    'active'
from provider
on conflict on constraint models_provider_id_model_id_key do update
set
    model_name = excluded.model_name,
    description = excluded.description,
    min_duration = excluded.min_duration,
    max_duration = excluded.max_duration,
    supported_ratios = excluded.supported_ratios,
    supported_resolutions = excluded.supported_resolutions,
    supported_durations = coalesce(public.models.supported_durations, excluded.supported_durations);
