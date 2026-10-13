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

create table if not exists public.support_agent_presence (
    id boolean primary key default true check (id),
    last_seen_at timestamptz not null default now()
);

alter table public.support_agent_presence enable row level security;
revoke all on table public.support_agent_presence
    from public, anon, authenticated;

create or replace function public.update_support_agent_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_genz_support_agent() then
        raise exception 'Only support agents can update support presence'
            using errcode = '42501';
    end if;

    insert into public.support_agent_presence (id, last_seen_at)
    values (true, now())
    on conflict (id) do update
        set last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.update_support_agent_presence() from public;
grant execute on function public.update_support_agent_presence() to authenticated;

create or replace function public.get_support_agent_presence()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.support_agent_presence
        where id
          and last_seen_at > now() - interval '90 seconds'
    );
$$;

revoke all on function public.get_support_agent_presence() from public;
grant execute on function public.get_support_agent_presence() to authenticated;

create table if not exists public.support_conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_name text not null default 'Pengunjung',
    user_email text,
    status text not null default 'open'
        check (status in ('open', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_message_at timestamptz not null default now(),
    last_user_message_at timestamptz,
    admin_read_at timestamptz,
    user_read_at timestamptz,
    admin_name text
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
    sender_role text not null,
    body text not null default '',
    image_data text,
    image_type text,
    created_at timestamptz not null default now(),
    busy_notice_for uuid references public.support_messages(id) on delete cascade,
    constraint support_messages_sender_role_check
        check (sender_role in ('user', 'support', 'system')),
    constraint support_messages_body_check
        check (char_length(trim(body)) <= 2000),
    constraint support_messages_content_check
        check (char_length(trim(body)) > 0 or image_data is not null),
    constraint support_messages_image_check
        check (
            (image_data is null and image_type is null)
            or (
                image_data is not null
                and image_type in ('image/webp', 'image/jpeg')
                and char_length(image_data) <= 900000
            )
        )
);

alter table public.support_conversations
    add column if not exists last_user_message_at timestamptz,
    add column if not exists admin_read_at timestamptz,
    add column if not exists user_read_at timestamptz,
    add column if not exists admin_name text;

alter table public.support_messages
    add column if not exists busy_notice_for uuid
        references public.support_messages(id) on delete cascade,
    add column if not exists image_data text,
    add column if not exists image_type text;

alter table public.support_messages
    alter column body set default '';

alter table public.support_messages
    drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
    add constraint support_messages_sender_role_check
        check (sender_role in ('user', 'support', 'system'));

alter table public.support_messages
    drop constraint if exists support_messages_body_check;

alter table public.support_messages
    add constraint support_messages_body_check
        check (char_length(trim(body)) <= 2000);

alter table public.support_messages
    drop constraint if exists support_messages_content_check;

alter table public.support_messages
    add constraint support_messages_content_check
        check (char_length(trim(body)) > 0 or image_data is not null);

alter table public.support_messages
    drop constraint if exists support_messages_image_check;

alter table public.support_messages
    add constraint support_messages_image_check
        check (
            (image_data is null and image_type is null)
            or (
                image_data is not null
                and image_type in ('image/webp', 'image/jpeg')
                and char_length(image_data) <= 900000
            )
        );

create unique index if not exists support_messages_busy_notice_once
    on public.support_messages (busy_notice_for)
    where busy_notice_for is not null;

update public.support_conversations c
set last_user_message_at = (
    select max(m.created_at)
    from public.support_messages m
    where m.conversation_id = c.id
      and m.sender_role = 'user'
)
where c.last_user_message_at is null;

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
        last_user_message_at = case
            when new.sender_role = 'user' then new.created_at
            else last_user_message_at
        end,
        updated_at = now()
    where id = new.conversation_id;
    return new;
end;
$$;

revoke all on function public.update_support_conversation_activity() from public;

create or replace function public.mark_support_conversation_read(
    p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_admin_name text;
    v_read_at timestamptz;
begin
    if not public.is_genz_support_agent() then
        raise exception 'Only support agents can mark conversations as read'
            using errcode = '42501';
    end if;

    select coalesce(
        nullif(trim(p.name), ''),
        nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
        nullif(auth.jwt() ->> 'email', ''),
        'Admin Support'
    )
    into v_admin_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = auth.uid();

    update public.support_conversations
    set admin_read_at = now(),
        admin_name = v_admin_name
    where id = p_conversation_id
      and status = 'open'
    returning admin_read_at into v_read_at;

    if not found then
        raise exception 'Open support conversation was not found'
            using errcode = 'P0002';
    end if;

    return jsonb_build_object(
        'admin_read_at', v_read_at,
        'admin_name', v_admin_name
    );
end;
$$;

revoke all on function public.mark_support_conversation_read(uuid) from public;
grant execute on function public.mark_support_conversation_read(uuid) to authenticated;

create or replace function public.mark_support_conversation_read_by_user(
    p_conversation_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_read_at timestamptz;
begin
    update public.support_conversations
    set user_read_at = now()
    where id = p_conversation_id
      and user_id = auth.uid()
      and status = 'open'
    returning user_read_at into v_read_at;

    if not found then
        raise exception 'Open support conversation was not found'
            using errcode = 'P0002';
    end if;

    return v_read_at;
end;
$$;

revoke all on function public.mark_support_conversation_read_by_user(uuid)
    from public;
grant execute on function public.mark_support_conversation_read_by_user(uuid)
    to authenticated;

create or replace function public.add_support_busy_notice(
    p_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_conversation public.support_conversations%rowtype;
    v_latest_user_message public.support_messages%rowtype;
    v_notice_id uuid;
begin
    select *
    into v_conversation
    from public.support_conversations
    where id = p_conversation_id
      and user_id = auth.uid()
      and status = 'open'
    for update;

    if not found then
        raise exception 'Open support conversation was not found'
            using errcode = 'P0002';
    end if;

    select *
    into v_latest_user_message
    from public.support_messages
    where conversation_id = p_conversation_id
      and sender_role = 'user'
    order by created_at desc, id desc
    limit 1;

    if not found
       or v_latest_user_message.created_at > now() - interval '5 minutes'
       or (
           v_conversation.admin_read_at is not null
           and v_conversation.admin_read_at >= v_latest_user_message.created_at
       )
    then
        return null;
    end if;

    insert into public.support_messages (
        conversation_id,
        sender_id,
        sender_role,
        body,
        busy_notice_for
    )
    values (
        p_conversation_id,
        auth.uid(),
        'system',
        'Mohon maaf, admin sedang sibuk, silahkan tunggu 10 menit, lalu coba lagi',
        v_latest_user_message.id
    )
    on conflict (busy_notice_for) where busy_notice_for is not null do nothing
    returning id into v_notice_id;

    return v_notice_id;
end;
$$;

revoke all on function public.add_support_busy_notice(uuid) from public;
grant execute on function public.add_support_busy_notice(uuid) to authenticated;

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
