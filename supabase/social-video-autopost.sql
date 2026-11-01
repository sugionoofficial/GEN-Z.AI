/* =========================================================
   GEN-Z.AI — MULTI-USER SOCIAL VIDEO AUTO POST (FB / YT / TIKTOK)
   ---------------------------------------------------------
   File:
     supabase/social-video-autopost.sql

   Menyediakan isolasi per-user (`user_id`), penyimpanan token
   terenkripsi AES-256-GCM, state OAuth PKCE sementara, serta
   antrean jadwal publikasi video atomik untuk cron Worker.
========================================================= */

-- 1. Pastikan tarif fitur `opusclip_social_post` terdaftar di feature_credit_settings
alter table public.feature_credit_settings
    drop constraint if exists feature_credit_settings_feature_id_check;

alter table public.feature_credit_settings
    add constraint feature_credit_settings_feature_id_check
    check (
        feature_id in (
            'vision',
            'vision_video',
            'upscale',
            'upscale_video',
            'prompt_studio',
            'metadata_cleaner',
            'opusclip_clipping',
            'opusclip_dubbing',
            'opusclip_thumbnail',
            'opusclip_censor_edit',
            'opusclip_understanding',
            'opusclip_motion_ui',
            'opusclip_social_post'
        )
    );

insert into public.feature_credit_settings (feature_id, label, credit_cost)
values
    ('opusclip_social_post', 'Social Video Auto Post (FB / YouTube / TikTok)', 250)
on conflict (feature_id) do update
set label = excluded.label;

-- 2. Ephemeral OAuth PKCE & CSRF State per user
create table if not exists public.social_video_oauth_states (
    id uuid primary key default gen_random_uuid(),
    state_hash text not null unique,
    user_id uuid not null references public.profiles(id) on delete cascade,
    platform text not null check (platform in ('facebook', 'youtube', 'tiktok')),
    code_verifier text null,
    return_path text not null default '/opusclip/?tab=social',
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists social_video_oauth_states_expires_idx
    on public.social_video_oauth_states (expires_at);

alter table public.social_video_oauth_states enable row level security;

revoke all on table public.social_video_oauth_states from public, anon, authenticated;
grant all on table public.social_video_oauth_states to service_role;

-- 3. Akun medsos terhubung per user (token dienkripsi AES-256-GCM oleh server)
create table if not exists public.social_video_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    platform text not null check (platform in ('facebook', 'youtube', 'tiktok')),
    external_account_id text not null,
    account_name text not null default '',
    account_handle text null,
    avatar_url text null,
    token_ciphertext text not null,
    token_iv text not null,
    token_tag text not null,
    refresh_ciphertext text null,
    refresh_iv text null,
    refresh_tag text null,
    token_expires_at timestamptz null,
    scopes text null,
    status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, platform, external_account_id)
);

create index if not exists social_video_accounts_user_idx
    on public.social_video_accounts (user_id, platform, created_at desc);

alter table public.social_video_accounts enable row level security;

-- Hanya service_role yang boleh mengakses tabel penuh (termasuk kolom ciphertext)
revoke all on table public.social_video_accounts from public, anon, authenticated;
grant all on table public.social_video_accounts to service_role;

-- 4. Antrean & riwayat posting video per user
create table if not exists public.social_video_posts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    account_id uuid not null references public.social_video_accounts(id) on delete cascade,
    platform text not null check (platform in ('facebook', 'youtube', 'tiktok')),
    video_source_type text not null default 'url' check (video_source_type in ('upload', 'history', 'url', 'opusclip')),
    video_ref text not null,
    title text not null default '',
    caption text not null default '',
    hashtags text not null default '',
    privacy_level text not null default 'public',
    scheduled_for timestamptz not null default now(),
    status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'published', 'failed', 'cancelled')),
    credit_transaction_id uuid null,
    credit_cost integer not null default 0,
    credit_refunded boolean not null default false,
    remote_post_id text null,
    remote_post_url text null,
    error_message text null,
    attempts integer not null default 0,
    published_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists social_video_posts_due_idx
    on public.social_video_posts (status, scheduled_for asc);

create index if not exists social_video_posts_user_idx
    on public.social_video_posts (user_id, created_at desc);

alter table public.social_video_posts enable row level security;

drop policy if exists "Users read own social video posts" on public.social_video_posts;
create policy "Users read own social video posts"
    on public.social_video_posts
    for select
    to authenticated
    using (auth.uid() = user_id);

grant select on table public.social_video_posts to authenticated;
grant all on table public.social_video_posts to service_role;

-- 5. Fungsi klaim atomik cron Worker (FOR UPDATE SKIP LOCKED)
create or replace function public.claim_due_social_video_posts(
    p_now timestamptz default now(),
    p_limit integer default 3
)
returns setof public.social_video_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit, 3), 10));
begin
    delete from public.social_video_oauth_states
    where expires_at < p_now - interval '1 hour';

    update public.social_video_posts
    set status = 'failed',
        error_message = 'Proses unggah melewati batas waktu server. Silakan periksa akun medsos sebelum mengirim ulang.',
        updated_at = p_now
    where status = 'processing'
      and updated_at < p_now - interval '25 minutes';

    return query
    with claimed as (
        select p.id
        from public.social_video_posts p
        where p.status = 'scheduled'
          and p.scheduled_for <= p_now
        order by p.scheduled_for asc
        limit v_limit
        for update skip locked
    )
    update public.social_video_posts target
    set status = 'processing',
        attempts = target.attempts + 1,
        updated_at = p_now
    from claimed
    where target.id = claimed.id
    returning target.*;
end;
$$;

revoke all on function public.claim_due_social_video_posts(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_video_posts(timestamptz, integer) to service_role;

notify pgrst, 'reload schema';
