-- ---------------------------------------------------------------------------
-- Autopublish per pengguna
--
-- Sebelumnya tombol "Aktifkan autopublish" di Studio Medsos mengubah satu baris
-- di social_publisher_config (id = true). Baris itu dipakai bersama semua akun,
-- sehingga satu pengguna yang mematikan autopublish ikut mematikan autopost
-- milik semua pengguna lain.
--
-- Migration ini memisahkan dua hal:
--   * social_publisher_user_settings.autopublish_enabled  -> switch milik user
--   * social_publisher_config.global_enabled              -> kill switch global
--     (hanya admin/owner, dipakai untuk menghentikan semua autopost sekaligus)
--
-- Autopost hanya berjalan bila switch user AKTIF dan master switch AKTIF.
-- Baris user yang belum ada dianggap AKTIF supaya jadwal lama tetap berjalan.
-- Aman dijalankan berulang pada database Social Publisher yang sudah ada.
-- ---------------------------------------------------------------------------

alter table public.social_publisher_user_settings
    add column if not exists autopublish_enabled boolean not null default true;

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
    -- dengan menjeda jadwalnya, bukan sekadar melewati klaim. Hasilnya
    -- jadwal terlihat "dijeda" di UI dan bisa diaktifkan kembali otomatis
    -- begitu masa aktif diperpanjang.
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
