-- Social image generation and Facebook Page scheduling.
-- Character references are stored in private Supabase Storage; generated images
-- are sent to the configured image provider and uploaded directly to Facebook.

create table if not exists public.social_characters (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    display_name text not null check (char_length(trim(display_name)) between 1 and 80),
    reference_object_key text not null unique,
    reference_filename text not null default 'reference-image',
    reference_mime_type text not null check (reference_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    reference_size_bytes integer not null check (reference_size_bytes between 1 and 8388608),
    garment_object_key text,
    garment_filename text,
    garment_mime_type text check (garment_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    garment_size_bytes integer check (garment_size_bytes between 1 and 8388608),
    prompt_notes text not null default '' check (char_length(prompt_notes) <= 1200),
    confirmed_rights boolean not null default false,
    confirmed_adult_subject boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id)
);

alter table public.social_characters
    add column if not exists garment_object_key text,
    add column if not exists garment_filename text,
    add column if not exists garment_mime_type text
        check (garment_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    add column if not exists garment_size_bytes integer
        check (garment_size_bytes between 1 and 8388608);

create unique index if not exists social_characters_garment_object_key_uidx
    on public.social_characters (garment_object_key)
    where garment_object_key is not null;

create table if not exists public.social_page_connections (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    page_id text not null,
    page_name text not null,
    page_token_ciphertext text not null,
    page_token_iv text not null,
    can_publish boolean not null default false,
    page_tasks text[] not null default '{}',
    token_checked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_id, page_id),
    unique (id, owner_id)
);

create table if not exists public.facebook_oauth_states (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    state_hash text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists facebook_oauth_states_expiry_idx
    on public.facebook_oauth_states (expires_at);

create table if not exists public.social_post_schedules (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    character_id uuid not null,
    page_connection_id uuid not null,
    enabled boolean not null default false,
    -- Autopost cadence: the server enforces a per-role floor (OWNER, ADMIN and
    -- USER start at once per hour); the column keeps the same 1..168h range.
    interval_hours integer not null default 24 check (interval_hours between 1 and 168),
    next_run_at timestamptz not null,
    timezone text not null default 'Asia/Jakarta' check (timezone = 'Asia/Jakarta'),
    aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9')),
    caption_template text not null default 'Cerita hari ini dari {location} ✨'
        check (char_length(caption_template) <= 1000),
    last_run_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint social_post_schedules_character_owner_fk
        foreign key (character_id, owner_id)
        references public.social_characters(id, owner_id)
        on delete restrict,
    constraint social_post_schedules_page_owner_fk
        foreign key (page_connection_id, owner_id)
        references public.social_page_connections(id, owner_id)
        on delete restrict,
    unique (id, owner_id)
);

alter table public.social_post_schedules
    add column if not exists aspect_ratio text not null default '9:16'
        check (aspect_ratio in ('9:16', '16:9'));

-- Auto publish hanya boleh berjalan selama langganan Studio Medsos aktif.
-- Jadwal yang dijeda otomatis karena langganan berhenti diberi tanda
-- 'subscription_inactive' supaya bisa diaktifkan kembali saat admin
-- memperpanjang masa aktif. Jadwal yang dijeda manual tetap null.
alter table public.social_post_schedules
    add column if not exists paused_reason text;

create index if not exists social_post_schedules_paused_reason_idx
    on public.social_post_schedules (owner_id, paused_reason)
    where enabled = false;

create index if not exists social_post_schedules_due_idx
    on public.social_post_schedules (next_run_at)
    where enabled = true;

create table if not exists public.social_post_runs (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    schedule_id uuid,
    page_connection_id uuid,
    status text not null default 'queued'
        check (status in ('queued', 'generating', 'posted', 'failed')),
    scheduled_for timestamptz not null,
    started_at timestamptz,
    finished_at timestamptz,
    scene_plan jsonb,
    generated_prompt text,
    caption text,
    image_model text,
    facebook_photo_id text,
    facebook_post_id text,
    permalink_url text,
    profile_share_url text,
    error_message text check (char_length(error_message) <= 1000),
    created_at timestamptz not null default now(),
    constraint social_post_runs_schedule_owner_fk
        foreign key (schedule_id, owner_id)
        references public.social_post_schedules(id, owner_id)
        on delete set null (schedule_id),
    unique (schedule_id, scheduled_for)
);

alter table public.social_post_runs
    add column if not exists page_connection_id uuid;

create index if not exists social_post_runs_owner_created_idx
    on public.social_post_runs (owner_id, created_at desc);

create index if not exists social_post_runs_schedule_created_idx
    on public.social_post_runs (schedule_id, created_at desc);

create table if not exists public.social_publisher_config (
    id boolean primary key default true check (id),
    global_enabled boolean not null default false,
    image_provider text not null default 'gemini'
        check (image_provider in ('gemini', 'cloudflare', 'qwencloud')),
    image_model text not null default '',
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.social_publisher_config
    add column if not exists image_provider text not null default 'gemini'
        check (image_provider in ('gemini', 'cloudflare', 'qwencloud'));

alter table public.social_publisher_config
    add column if not exists image_model text not null default '';

alter table public.social_publisher_config
    drop constraint if exists social_publisher_config_image_provider_check;

alter table public.social_publisher_config
    add constraint social_publisher_config_image_provider_check
        check (image_provider in ('gemini', 'cloudflare', 'qwencloud'));

create table if not exists public.social_publisher_model_quotas (
    model text primary key,
    requests_used integer not null default 0 check (requests_used >= 0),
    quota_limit integer not null default 0 check (quota_limit >= 0),
    exhausted boolean not null default false,
    last_status text not null default '',
    window_started_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.social_publisher_user_settings (
    owner_id uuid primary key references public.profiles(id) on delete cascade,
    caption_template text not null default 'Cerita hari ini ✨'
        check (char_length(caption_template) <= 1000),
    external_link text not null default ''
        check (char_length(external_link) <= 500),
    -- Switch autopublish milik masing-masing user. Mematikan ini hanya
    -- menghentikan autopost user tersebut, bukan user lain.
    autopublish_enabled boolean not null default true,
    updated_at timestamptz not null default now()
);

insert into public.social_publisher_config (id, global_enabled)
values (true, false)
on conflict (id) do nothing;

alter table public.social_characters enable row level security;
alter table public.social_page_connections enable row level security;
alter table public.facebook_oauth_states enable row level security;
alter table public.social_post_schedules enable row level security;
alter table public.social_post_runs enable row level security;
alter table public.social_publisher_config enable row level security;
alter table public.social_publisher_user_settings enable row level security;
alter table public.social_publisher_model_quotas enable row level security;

revoke all on table public.social_characters from public, anon, authenticated;
revoke all on table public.social_page_connections from public, anon, authenticated;
revoke all on table public.facebook_oauth_states from public, anon, authenticated;
revoke all on table public.social_post_schedules from public, anon, authenticated;
revoke all on table public.social_post_runs from public, anon, authenticated;
revoke all on table public.social_publisher_config from public, anon, authenticated;
revoke all on table public.social_publisher_user_settings from public, anon, authenticated;
revoke all on table public.social_publisher_model_quotas from public, anon, authenticated;

grant select, insert, update, delete on table public.social_characters to service_role;
grant select, insert, update, delete on table public.social_page_connections to service_role;
grant select, insert, update, delete on table public.facebook_oauth_states to service_role;
grant select, insert, update, delete on table public.social_post_schedules to service_role;
grant select, insert, update, delete on table public.social_post_runs to service_role;
grant select, insert, update, delete on table public.social_publisher_config to service_role;
grant select, insert, update, delete on table public.social_publisher_user_settings to service_role;
grant select, insert, update, delete on table public.social_publisher_model_quotas to service_role;

create or replace function public.claim_due_social_post_schedules(
    p_now timestamptz default now(),
    p_limit integer default 2
)
returns table (run_id uuid, schedule_id uuid, scheduled_for timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_schedule record;
    v_run_id uuid;
    v_scheduled_for timestamptz;
    v_limit integer := greatest(1, least(coalesce(p_limit, 2), 5));
begin
    delete from public.facebook_oauth_states
    where expires_at < p_now - interval '1 day';

    if not exists (
        select 1
        from public.social_publisher_config
        where id = true and global_enabled = true
    ) then
        return;
    end if;

    -- Langganan Studio Medsos berakhir / dimatikan: hentikan auto publish
    -- dengan menjeda jadwalnya, bukan sekadar melewati klaim. Hasilnya
    -- jadwal terlihat "dijeda" di UI dan bisa diaktifkan kembali otomatis
    -- begitu masa aktif diperpanjang.
    if to_regclass('public.studio_medsos_access') is not null then
        update public.social_post_schedules s
        set enabled = false,
            paused_reason = 'subscription_inactive',
            updated_at = p_now
        where s.enabled = true
          and not exists (
              select 1
              from public.studio_medsos_access a
              where a.user_id = s.owner_id
                and a.is_active = true
                and a.started_at <= p_now
                and a.expires_at > p_now
          );
    end if;

    update public.social_post_runs
    set status = 'failed',
        error_message = 'Worker berhenti sebelum run selesai. Periksa posting Facebook sebelum menjalankan ulang.',
        finished_at = p_now
    where status in ('queued', 'generating')
      and created_at < p_now - interval '30 minutes';

    for v_schedule in
        select s.id, s.owner_id, s.interval_hours, s.next_run_at
        from public.social_post_schedules s
        where s.enabled = true
          and s.next_run_at <= p_now
          -- Switch autopublish milik pemilik jadwal. Baris yang belum ada
          -- dianggap aktif agar jadwal lama tidak ikut berhenti.
          and coalesce(
              (
                  select u.autopublish_enabled
                  from public.social_publisher_user_settings u
                  where u.owner_id = s.owner_id
              ),
              true
          ) = true
        order by s.next_run_at asc
        limit v_limit
        for update skip locked
    loop
        v_run_id := gen_random_uuid();
        v_scheduled_for := v_schedule.next_run_at;

        insert into public.social_post_runs (
            id, owner_id, schedule_id, status, scheduled_for
        ) values (
            v_run_id, v_schedule.owner_id, v_schedule.id, 'queued', v_scheduled_for
        );

        update public.social_post_schedules
        set next_run_at = p_now + make_interval(hours => v_schedule.interval_hours),
            last_run_at = p_now,
            updated_at = p_now
        where id = v_schedule.id;

        run_id := v_run_id;
        schedule_id := v_schedule.id;
        scheduled_for := v_scheduled_for;
        return next;
    end loop;
end;
$$;

revoke all on function public.claim_due_social_post_schedules(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_post_schedules(timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Outfit library
-- Each character can own several outfits. Every generated post picks one active
-- outfit at random, uses its photo as the try-on garment, and appends the outfit
-- name plus its order link to the caption next to the AI-generated sentence.
-- Safe to run again on an existing Social Publisher database.
-- ---------------------------------------------------------------------------

create table if not exists public.social_outfits (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    character_id uuid not null,
    name text not null check (char_length(trim(name)) between 1 and 80),
    object_key text not null unique,
    filename text not null default 'outfit-image',
    mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes integer not null check (size_bytes between 1 and 8388608),
    order_url text not null default '' check (char_length(order_url) <= 500),
    notes text not null default '' check (char_length(notes) <= 400),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint social_outfits_character_owner_fk
        foreign key (character_id, owner_id)
        references public.social_characters(id, owner_id)
        on delete cascade,
    unique (id, owner_id)
);

create index if not exists social_outfits_character_active_idx
    on public.social_outfits (character_id, is_active, created_at desc);

create index if not exists social_outfits_owner_created_idx
    on public.social_outfits (owner_id, created_at desc);

-- Snapshot of the randomly selected outfit on each run so the history and the
-- published caption stay explainable even after the outfit is edited/deleted.
alter table public.social_post_runs
    add column if not exists outfit_id uuid,
    add column if not exists outfit_name text,
    add column if not exists outfit_order_url text;

alter table public.social_outfits enable row level security;

revoke all on table public.social_outfits from public, anon, authenticated;
grant select, insert, update, delete on table public.social_outfits to service_role;

-- ---------------------------------------------------------------------------
-- Meta Data Deletion Request Callback
-- Meta requires every Facebook Login app to expose a public deletion callback.
-- The callback verifies `signed_request` with the app secret, deletes the data
-- received from Facebook, and answers with a confirmation code + status URL.
-- Safe to run again on an existing Social Publisher database.
-- ---------------------------------------------------------------------------

-- Maps a GEN-Z.AI account to the Facebook user that authorized the Page.
-- Written by the OAuth callback so deletion requests can be traced back.
-- A single Facebook account may authorize several GEN-Z.AI accounts, so
-- `fb_user_id` is indexed but not unique; `owner_id` stays the primary key.
create table if not exists public.social_facebook_identities (
    owner_id uuid primary key references public.profiles(id) on delete cascade,
    fb_user_id text not null check (char_length(fb_user_id) between 1 and 80),
    linked_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists social_facebook_identities_fb_user_idx
    on public.social_facebook_identities (fb_user_id);

-- Audit trail for deletion requests. `confirmation_code` is the public handle
-- shown by Meta; `deleted_counts` records how many rows were removed per table.
create table if not exists public.social_data_deletion_requests (
    id uuid primary key default gen_random_uuid(),
    confirmation_code text not null unique check (char_length(confirmation_code) between 6 and 32),
    fb_user_id text,
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'failed')),
    matched_user_ids uuid[] not null default '{}',
    deleted_counts jsonb not null default '{}'::jsonb,
    error_message text check (char_length(error_message) <= 500),
    requested_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists social_data_deletion_requests_requested_idx
    on public.social_data_deletion_requests (requested_at desc);

create index if not exists social_data_deletion_requests_fb_user_idx
    on public.social_data_deletion_requests (fb_user_id)
    where fb_user_id is not null;

alter table public.social_facebook_identities enable row level security;
alter table public.social_data_deletion_requests enable row level security;

revoke all on table public.social_facebook_identities from public, anon, authenticated;
revoke all on table public.social_data_deletion_requests from public, anon, authenticated;

grant select, insert, update, delete on table public.social_facebook_identities to service_role;
grant select, insert, update, delete on table public.social_data_deletion_requests to service_role;
