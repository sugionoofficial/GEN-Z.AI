-- Migrasi: cegah dua autopost berjalan bersamaan untuk jadwal yang sama.
--
-- Latar belakang: `claim_due_social_post_schedules` sebelumnya hanya melihat
-- `next_run_at <= now()` tanpa memeriksa run yang belum selesai. Selama generate
-- normal (~70 detik) ini tidak terasa, tetapi bila satu run menggantung lebih
-- lama dari interval jadwal, interval berikutnya tetap membuat run baru sehingga
-- dua posting terbit berdekatan (atau tumpang tindih) untuk jadwal yang sama.
--
-- Perilaku baru: bila jadwal masih punya run berstatus 'queued'/'generating',
-- klaim dilewati dan `next_run_at` digeser satu interval penuh. `last_run_at`
-- TIDAK diubah karena memang tidak ada run yang dimulai.
--
-- Sapuan run yatim 30 menit dijalankan sebelum loop, jadi run yang benar-benar
-- mati (worker berhenti) tetap ditutup lebih dulu dan tidak memblokir selamanya.
--
-- Aman dijalankan ulang (idempotent): hanya `create or replace function`.

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
        /*
         * Jangan buat run baru selama run sebelumnya untuk jadwal ini belum
         * selesai. Tanpa penjagaan ini, run yang menggantung melewati satu
         * interval akan membuat run kedua berjalan paralel.
         */
        if exists (
            select 1
            from public.social_post_runs r
            where r.schedule_id = v_schedule.id
              and r.status in ('queued', 'generating')
        ) then
            update public.social_post_schedules
            set next_run_at = p_now + make_interval(mins => v_schedule.interval_minutes),
                updated_at = p_now
            where id = v_schedule.id;
            continue;
        end if;

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

comment on function public.claim_due_social_post_schedules(timestamp with time zone, integer) is
    'Membuat run autopost untuk jadwal yang jatuh tempo. Klaim dilewati (next_run_at digeser satu interval) bila jadwal masih punya run queued/generating.';
