-- Private, per-user archive for Studio Flow task metadata and output references.
-- Do not store Google credentials, browser cookies, or inline/base64 media here.
create table if not exists public.studio_flow_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  title text not null default '',
  prompt text not null default '' check (char_length(prompt) <= 5000),
  model text not null default '' check (char_length(model) <= 120),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  outputs jsonb not null default '[]'::jsonb check (case when jsonb_typeof(outputs) = 'array' then jsonb_array_length(outputs) <= 4 else false end),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_flow_history_user_created_idx
  on public.studio_flow_history (user_id, created_at desc);

alter table public.studio_flow_history enable row level security;

drop policy if exists "studio_flow_history_owner_select" on public.studio_flow_history;
create policy "studio_flow_history_owner_select" on public.studio_flow_history
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "studio_flow_history_owner_insert" on public.studio_flow_history;
create policy "studio_flow_history_owner_insert" on public.studio_flow_history
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "studio_flow_history_owner_update" on public.studio_flow_history;
create policy "studio_flow_history_owner_update" on public.studio_flow_history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "studio_flow_history_owner_delete" on public.studio_flow_history;
create policy "studio_flow_history_owner_delete" on public.studio_flow_history
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.studio_flow_history to authenticated;
