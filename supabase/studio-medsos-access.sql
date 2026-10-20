create table if not exists public.studio_medsos_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default false,
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_studio_medsos_access_active
  on public.studio_medsos_access (is_active, expires_at);

alter table public.studio_medsos_access enable row level security;

create policy "Users can view their own studio access"
  on public.studio_medsos_access
  for select
  using (auth.uid() = user_id);

create policy "Admins can manage studio access"
  on public.studio_medsos_access
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role, '')) in ('ADMIN', 'OWNER')
        and lower(coalesce(p.status, '')) = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role, '')) in ('ADMIN', 'OWNER')
        and lower(coalesce(p.status, '')) = 'active'
    )
  );

create or replace function public.set_studio_medsos_access(
  target_user_id uuid,
  is_active boolean,
  duration_days integer,
  started_at timestamptz default now(),
  expires_at timestamptz default null
)
returns public.studio_medsos_access
language plpgsql
security definer
set search_path = public, pg_temp
as $$
  declare
    final_duration integer := duration_days;
    final_started timestamptz := coalesce(started_at, now());
    final_expires timestamptz;
    row public.studio_medsos_access;
  begin
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role, '')) in ('ADMIN', 'OWNER')
        and lower(coalesce(p.status, '')) = 'active'
    ) then
      raise exception 'Hanya admin aktif yang dapat mengatur akses Studio Medsos';
    end if;

    if final_duration < 1 or final_duration > 365 then
      raise exception 'Durasi langganan harus antara 1 dan 365 hari';
    end if;

    final_expires := final_started + (final_duration || ' days')::interval;

    insert into public.studio_medsos_access(user_id, is_active, duration_days, started_at, expires_at, updated_at, updated_by)
    values(target_user_id, is_active, final_duration, final_started, final_expires, now(), auth.uid())
    on conflict (user_id)
    do update set
      is_active = excluded.is_active,
      duration_days = excluded.duration_days,
      started_at = excluded.started_at,
      expires_at = excluded.expires_at,
      updated_at = now(),
      updated_by = auth.uid()
    returning * into row;

    return row;
  end;
$$;

revoke all on function public.set_studio_medsos_access(uuid, boolean, integer, timestamptz, timestamptz) from public;
grant execute on function public.set_studio_medsos_access(uuid, boolean, integer, timestamptz, timestamptz) to authenticated;
