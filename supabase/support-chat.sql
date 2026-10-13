create or replace function public.is_genz_support_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and upper(trim(coalesce(role::text, ''))) in ('ADMIN', 'OWNER')
    );
$$;

revoke all on function public.is_genz_support_agent() from public;
grant execute on function public.is_genz_support_agent() to authenticated;

create table if not exists public.support_conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_name text not null default 'Pengunjung',
    user_email text,
    status text not null default 'open'
        check (status in ('open', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_message_at timestamptz not null default now()
);

create unique index if not exists support_conversations_one_open_per_user
    on public.support_conversations (user_id)
    where status = 'open';

create index if not exists support_conversations_open_activity
    on public.support_conversations (last_message_at desc)
    where status = 'open';

create table if not exists public.support_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null
        references public.support_conversations(id) on delete cascade,
    sender_id uuid not null references auth.users(id) on delete cascade,
    sender_role text not null check (sender_role in ('user', 'support')),
    body text not null check (char_length(trim(body)) between 1 and 2000),
    created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_created
    on public.support_messages (conversation_id, created_at, id);

create or replace function public.update_support_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.support_conversations
    set last_message_at = new.created_at,
        updated_at = now()
    where id = new.conversation_id;
    return new;
end;
$$;

revoke all on function public.update_support_conversation_activity() from public;

drop trigger if exists support_messages_update_conversation_activity
    on public.support_messages;

create trigger support_messages_update_conversation_activity
after insert on public.support_messages
for each row
execute function public.update_support_conversation_activity();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;

drop policy if exists support_conversations_select_participant_or_support
    on public.support_conversations;
create policy support_conversations_select_participant_or_support
    on public.support_conversations
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
        or (select public.is_genz_support_agent())
    );

drop policy if exists support_conversations_insert_owner
    on public.support_conversations;
create policy support_conversations_insert_owner
    on public.support_conversations
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and status = 'open'
    );

drop policy if exists support_conversations_update_support
    on public.support_conversations;
create policy support_conversations_update_support
    on public.support_conversations
    for update
    to authenticated
    using ((select public.is_genz_support_agent()))
    with check ((select public.is_genz_support_agent()));

drop policy if exists support_messages_select_participant_or_support
    on public.support_messages;
create policy support_messages_select_participant_or_support
    on public.support_messages
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.support_conversations c
            where c.id = conversation_id
              and (
                  c.user_id = (select auth.uid())
                  or (select public.is_genz_support_agent())
              )
        )
    );

drop policy if exists support_messages_insert_sender
    on public.support_messages;
create policy support_messages_insert_sender
    on public.support_messages
    for insert
    to authenticated
    with check (
        sender_id = (select auth.uid())
        and exists (
            select 1
            from public.support_conversations c
            where c.id = conversation_id
              and c.status = 'open'
              and (
                  (
                      sender_role = 'user'
                      and c.user_id = (select auth.uid())
                  )
                  or (
                      sender_role = 'support'
                      and (select public.is_genz_support_agent())
                  )
              )
        )
    );

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'support_conversations'
    ) then
        alter publication supabase_realtime
            add table public.support_conversations;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'support_messages'
    ) then
        alter publication supabase_realtime
            add table public.support_messages;
    end if;
end;
$$;
