-- Admin Copilot Sessions — persistent chat history + connectors state
-- Enables: multiple sessions per admin, Supabase sync, Cloudflare status cache

create table if not exists public.copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Percakapan Baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  messages jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.copilot_sessions enable row level security;

drop policy if exists "cp_sessions_owner_all" on public.copilot_sessions;
create policy "cp_sessions_owner_all" on public.copilot_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_copilot_sessions_user_updated on public.copilot_sessions(user_id, updated_at desc);

-- Uploads bucket for copilot file attachments (if not exists)
insert into storage.buckets (id, name, public) values ('copilot-uploads', 'copilot-uploads', false)
on conflict (id) do nothing;

drop policy if exists "cp_uploads_owner_all" on storage.objects;
create policy "cp_uploads_owner_all" on storage.objects
  for all using (bucket_id = 'copilot-uploads' and auth.uid()::text = (owner::text))
  with check (bucket_id = 'copilot-uploads' and auth.uid()::text = (owner::text));
