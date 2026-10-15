create table if not exists public.site_announcements (
    id smallint primary key default 1 check (id = 1),
    title text not null default '' check (char_length(title) <= 100),
    message text not null default '' check (char_length(message) <= 3000),
    category text not null default 'info'
        check (category in ('info', 'feature', 'maintenance', 'important')),
    is_published boolean not null default false,
    expires_at timestamptz,
    updated_at timestamptz not null default pg_catalog.now(),
    updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_announcements enable row level security;
revoke all on public.site_announcements from public, anon, authenticated;
grant all on public.site_announcements to service_role;

notify pgrst, 'reload schema';
