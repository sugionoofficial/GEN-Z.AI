-- ---------------------------------------------------------------------------
-- Autopublish per blok jadwal + parameter detail generate gambar
--
-- 1. Setiap blok jadwal kini punya switch autopublish sendiri
--    (social_post_schedules.autopublish_enabled). Mematikan satu jadwal tidak
--    memengaruhi jadwal lain milik user itu maupun jadwal user lain.
--    Autopost hanya berjalan bila SEMUA kondisi ini benar:
--      * master switch  social_publisher_config.global_enabled = true
--      * switch akun    social_publisher_user_settings.autopublish_enabled
--      * switch jadwal  social_post_schedules.autopublish_enabled
--      * langganan Studio Medsos aktif (dicek worker)
--
-- 2. Kolom parameter gambar per jadwal. Kolom kosong berarti "otomatis":
--      scene_location   kosong -> lokasi acak
--      camera_angle     kosong -> "medium shot"
--      scene_situation  kosong -> aktivitas acak
--      scene_lighting   kosong -> pencahayaan acak
--      scene_atmosphere kosong -> suasana acak
--      scene_condition  kosong -> kondisi/cuaca acak
--      scene_details    catatan tambahan untuk prompt (opsional)
--      negative_prompt  tambahan negative prompt; negative prompt otomatis
--                       dari aplikasi selalu ikut terkirim
--
-- Aman dijalankan berulang pada database Social Publisher yang sudah ada.
-- ---------------------------------------------------------------------------

alter table public.social_post_schedules
    add column if not exists autopublish_enabled boolean not null default true;

alter table public.social_post_schedules
    add column if not exists scene_location text not null default ''
        check (char_length(scene_location) <= 400);

alter table public.social_post_schedules
    add column if not exists camera_angle text not null default ''
        check (char_length(camera_angle) <= 200);

alter table public.social_post_schedules
    add column if not exists scene_situation text not null default ''
        check (char_length(scene_situation) <= 400);

alter table public.social_post_schedules
    add column if not exists scene_lighting text not null default ''
        check (char_length(scene_lighting) <= 300);

alter table public.social_post_schedules
    add column if not exists scene_atmosphere text not null default ''
        check (char_length(scene_atmosphere) <= 300);

alter table public.social_post_schedules
    add column if not exists scene_condition text not null default ''
        check (char_length(scene_condition) <= 300);

alter table public.social_post_schedules
    add column if not exists scene_details text not null default ''
        check (char_length(scene_details) <= 400);

alter table public.social_post_schedules
    add column if not exists negative_prompt text not null default ''
        check (char_length(negative_prompt) <= 400);

create or replace function public.claim_due_social_post_schedules(
    p_now timestamptz default now(),
    p_limit integer default 2
)
returns table (run_id uuid, schedule_id uuid, scheduled_for timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_schedule record;
    v_run_id uuid;
    v_scheduled_for timestamptz;
    v_limit integer := greatest(1, least(coalesce(p_limit, 2), 5));
begin
    delete from public.facebook_oauth_states
    where expires_at < p_now - interval '1 day';

    -- Master switch (admin/owner). Mematikan ini menghentikan seluruh autopost.
    if not exists (
        select 1
        from public.social_publisher_config
        where id = true and global_enabled = true
    ) then
        return;
    end if;

    -- Langganan Studio Medsos berakhir / dimatikan: hentikan auto publish
    -- dengan menjeda jadwalnya, bukan sekadar melewati klaim.
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
          -- Switch autopublish milik jadwal itu sendiri.
          and s.autopublish_enabled = true
          -- Switch autopublish milik pemilik jadwal. Baris yang belum ada
          -- dianggap aktif agar jadwal lama tidak ikut berhenti.
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
$$;

revoke all on function public.claim_due_social_post_schedules(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_post_schedules(timestamptz, integer) to service_role;
