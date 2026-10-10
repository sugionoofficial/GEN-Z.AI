create table if not exists public.user_presence (
    user_id uuid not null references auth.users(id) on delete cascade,
    session_id uuid not null,
    last_seen timestamptz not null default pg_catalog.now(),
    primary key (user_id, session_id)
);

create index if not exists user_presence_last_seen_idx
    on public.user_presence (last_seen desc);

create or replace function public.set_user_presence_last_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.last_seen := pg_catalog.now();
    return new;
end;
$$;

drop trigger if exists set_user_presence_last_seen
    on public.user_presence;

create trigger set_user_presence_last_seen
    before insert or update on public.user_presence
    for each row
    execute function public.set_user_presence_last_seen();

create or replace function public.is_presence_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles as profile
        where profile.id = (select auth.uid())
          and upper(coalesce(profile.role::text, '')) in ('ADMIN', 'OWNER')
    );
$$;

revoke all on function public.is_presence_admin() from public;
grant execute on function public.is_presence_admin() to authenticated;

revoke all on table public.user_presence from public, anon;
grant select, insert, update, delete
    on table public.user_presence
    to authenticated;

alter table public.user_presence enable row level security;

drop policy if exists "Users manage own presence"
    on public.user_presence;

create policy "Users manage own presence"
    on public.user_presence
    for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Admins read all presence"
    on public.user_presence;

create policy "Admins read all presence"
    on public.user_presence
    for select
    to authenticated
    using (public.is_presence_admin());
