-- Migrasi: interval autopost dalam menit (ADMIN/OWNER tercepat 5 menit, USER 60 menit)
-- dan batas posting per akun (profiles.post_limit, NULL = default role).
-- Aman dijalankan ulang (idempotent).

alter table public.social_post_schedules
    add column if not exists interval_minutes integer not null default 1440;

update public.social_post_schedules
set interval_minutes = least(10080, greatest(5, interval_hours * 60));

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'social_post_schedules_interval_minutes_chk'
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_interval_minutes_chk
            check (interval_minutes between 5 and 10080);
    end if;
end $$;

alter table public.profiles
    add column if not exists post_limit integer;

comment on column public.profiles.post_limit is
    'Batas maksimal jadwal autopost per akun. NULL = default role (USER 2, ADMIN/OWNER tanpa batas).';

-- Fungsi claim autopublish kini memakai interval_minutes.
create or replace function public.claim_due_social_post_schedules(p_now timestamp with time zone default now(), p_limit integer default 2)
returns table(run_id uuid, schedule_id uuid, scheduled_for timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $function$
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
        select s.id, s.owner_id, s.interval_minutes, s.next_run_at
        from public.social_post_schedules s
        where s.enabled = true
          and s.next_run_at <= p_now
          and s.autopublish_enabled = true
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
        set next_run_at = p_now + make_interval(mins => v_schedule.interval_minutes),
            last_run_at = p_now,
            updated_at = p_now
        where id = v_schedule.id;

        run_id := v_run_id;
        schedule_id := v_schedule.id;
        scheduled_for := v_scheduled_for;
        return next;
    end loop;
end;
$function$;
