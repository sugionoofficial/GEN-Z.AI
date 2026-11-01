/* =========================================================
   GEN-Z.AI — OPUSCLIP MOTION UI REMOTION JOBS
   ---------------------------------------------------------
   File:
     supabase/motion-ui-jobs.sql

   Menyimpan antrean & status render video animasi produk/UI
   berbasis Remotion yang dijalankan lewat GitHub Actions
   (`.github/workflows/motion-ui-render.yml`).
========================================================= */

create table if not exists public.motion_ui_jobs (
    id uuid primary key default gen_random_uuid(),
    job_key text not null unique,
    user_id uuid not null references public.profiles(id) on delete cascade,
    transaction_id uuid null references public.feature_credit_transactions(transaction_id) on delete set null,
    history_id uuid null,
    template_id text not null,
    aspect_ratio text not null default '16:9',
    duration_sec integer not null default 10,
    props jsonb not null default '{}'::jsonb,
    status text not null default 'queued' check (status in ('queued', 'rendering', 'completed', 'failed')),
    progress integer not null default 0,
    result_url text null,
    error_message text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz null
);

create index if not exists motion_ui_jobs_user_created_idx
    on public.motion_ui_jobs (user_id, created_at desc);

alter table public.motion_ui_jobs enable row level security;

drop policy if exists "Users can read own motion_ui_jobs" on public.motion_ui_jobs;
create policy "Users can read own motion_ui_jobs"
    on public.motion_ui_jobs
    for select
    to authenticated
    using (auth.uid() = user_id);
