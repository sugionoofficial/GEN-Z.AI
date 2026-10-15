create table if not exists public.site_announcements (
    id smallint primary key default 1 check (id = 1),
    title text not null default '' check (char_length(title) <= 100),
    message text not null default '' check (char_length(message) <= 3000),
    category text not null default 'info'
        check (category in ('info', 'feature', 'maintenance', 'important')),
    media_url text,
    media_type text check (media_type in ('image', 'video')),
    cta_url text,
    is_published boolean not null default false,
    expires_at timestamptz,
    updated_at timestamptz not null default pg_catalog.now(),
    updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_announcements
    add column if not exists media_url text,
    add column if not exists media_type text,
    add column if not exists cta_url text;

alter table public.site_announcements
    drop constraint if exists site_announcements_media_type_check;

alter table public.site_announcements
    add constraint site_announcements_media_type_check
        check (media_type is null or media_type in ('image', 'video'));

alter table public.site_announcements enable row level security;
revoke all on public.site_announcements from public, anon, authenticated;
grant all on public.site_announcements to service_role;

notify pgrst, 'reload schema';
