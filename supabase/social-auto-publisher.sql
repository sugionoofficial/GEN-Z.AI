-- Social image generation and Facebook Page scheduling.
-- Character references are stored privately in Cloudflare R2; generated images
-- are sent to the configured image provider and uploaded directly to Facebook.

create table if not exists public.social_characters (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    display_name text not null check (char_length(trim(display_name)) between 1 and 80),
    reference_object_key text not null unique,
    reference_filename text not null default 'reference-image',
    reference_mime_type text not null check (reference_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    reference_size_bytes integer not null check (reference_size_bytes between 1 and 8388608),
    prompt_notes text not null default '' check (char_length(prompt_notes) <= 1200),
    confirmed_rights boolean not null default false,
    confirmed_adult_subject boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id)
);

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
    interval_hours integer not null default 24 check (interval_hours between 1 and 168),
    next_run_at timestamptz not null,
    timezone text not null default 'Asia/Jakarta' check (timezone = 'Asia/Jakarta'),
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

create index if not exists social_post_schedules_due_idx
    on public.social_post_schedules (next_run_at)
    where enabled = true;

create table if not exists public.social_post_runs (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    schedule_id uuid,
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

create index if not exists social_post_runs_owner_created_idx
    on public.social_post_runs (owner_id, created_at desc);

create index if not exists social_post_runs_schedule_created_idx
    on public.social_post_runs (schedule_id, created_at desc);

create table if not exists public.social_publisher_config (
    id boolean primary key default true check (id),
    global_enabled boolean not null default false,
    updated_by uuid references public.profiles(id) on delete set null,
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

revoke all on table public.social_characters from public, anon, authenticated;
revoke all on table public.social_page_connections from public, anon, authenticated;
revoke all on table public.facebook_oauth_states from public, anon, authenticated;
revoke all on table public.social_post_schedules from public, anon, authenticated;
revoke all on table public.social_post_runs from public, anon, authenticated;
revoke all on table public.social_publisher_config from public, anon, authenticated;

grant select, insert, update, delete on table public.social_characters to service_role;
grant select, insert, update, delete on table public.social_page_connections to service_role;
grant select, insert, update, delete on table public.facebook_oauth_states to service_role;
grant select, insert, update, delete on table public.social_post_schedules to service_role;
grant select, insert, update, delete on table public.social_post_runs to service_role;
grant select, insert, update, delete on table public.social_publisher_config to service_role;

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
    if not exists (
        select 1
        from public.social_publisher_config
        where id = true and global_enabled = true
    ) then
        return;
    end if;

    delete from public.facebook_oauth_states
    where expires_at < p_now - interval '1 day';

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
