/* =========================================================
   GEN-Z.AI — SOCIAL PUBLISHER HEALTH CHECK
   ---------------------------------------------------------
   Status: SUDAH DIJALANKAN di project ycovbqmezhrvzobxqnyp
           (GEN-Z.AI) pada 2026-10-29. Idempotent.

   LATAR BELAKANG
   Autopost Facebook berjalan lewat cron Cloudflare Worker tiap
   menit (wrangler.toml: crons = ["* * * * *"]), memakai
   SUPABASE_SERVICE_ROLE_KEY — jadi TIDAK terpengaruh umur JWT
   user (jwt_exp 1 jam). Yang benar-benar bisa menghentikannya:

     1. langganan Studio Medsos habis  (getSubscriptionState,
        social-publisher-cron.js:208/584 -> jadwal di-pause)
     2. token Facebook dicabut/expired (social_page_connections)
     3. run menggantung > 30 menit     (AUTO_ABANDONED_TTL_MS)
     4. kuota model/provider habis     (model auto-disabled)

   CATATAN STATUS: run Social Publisher yang sukses berstatus 'posted'
   (bukan 'success'). Kumpulan status sukses dibuat eksplisit:
   ('posted','success','published','completed','done').

   Fungsi ini merangkum keempat risiko itu dalam satu panggilan
   supaya bisa dipantau manusia maupun cron/dashboard.

   KEAMANAN
   SECURITY DEFINER (perlu membaca tabel yang RLS-nya tertutup
   untuk authenticated). Karena itu pemeriksaan pemanggil TIDAK
   boleh memakai current_user (di definer, nilainya jadi owner).
   Dipakai `current_setting('role')` + is_admin_or_owner():
     - service_role / postgres  -> boleh (cron & SQL editor)
     - anon / authenticated     -> wajib admin aktif
   EXECUTE: service_role + authenticated (panel admin), anon dicabut.
========================================================= */

begin;

create or replace function public.social_publisher_health()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_role text := coalesce(current_setting('role', true), '');
    v_schedules_total int := 0;
    v_schedules_enabled int := 0;
    v_schedules_paused int := 0;
    v_subs_active int := 0;
    v_subs_expiring int := 0;
    v_subs_expired int := 0;
    v_earliest_expiry timestamptz;
    v_orphan_schedules int := 0;
    v_runs_active int := 0;
    v_runs_stale int := 0;
    v_runs_failed_24h int := 0;
    v_runs_success_24h int := 0;
    v_last_success_at timestamptz;
    v_opus_tokens int := 0;
    v_opus_expired int := 0;
    v_opus_nearest timestamptz;
    v_opus_relogin int := 0;
    v_fb_restricted int := 0;
    v_policy_rejects int := 0;
    v_alerts jsonb := '[]'::jsonb;
begin
    /* ---------- otorisasi ---------- */
    if v_role in ('anon', 'authenticated') then
        if not public.is_admin_or_owner() then
            raise exception 'ADMIN_ONLY'
                using errcode = '42501',
                      hint = 'Health check Social Publisher hanya untuk admin.';
        end if;
    end if;

    /* ---------- jadwal ---------- */
    select count(*),
           count(*) filter (where enabled),
           count(*) filter (where not enabled and paused_reason is not null)
      into v_schedules_total, v_schedules_enabled, v_schedules_paused
      from public.social_post_schedules;

    /* ---------- langganan ---------- */
    select count(*) filter (where is_active and expires_at > now()),
           count(*) filter (where is_active and expires_at > now() and expires_at <= now() + interval '3 days'),
           count(*) filter (where (not is_active) or expires_at <= now()),
           min(expires_at) filter (where is_active and expires_at > now())
      into v_subs_active, v_subs_expiring, v_subs_expired, v_earliest_expiry
      from public.studio_medsos_access;

    select count(*)
      into v_orphan_schedules
      from public.social_post_schedules s
     where s.enabled
       and not exists (
           select 1
             from public.studio_medsos_access a
            where a.user_id = s.owner_id
              and a.is_active
              and a.started_at <= now()
              and a.expires_at > now()
       );

    /* ---------- run (24 jam terakhir + penyebab gagal) ---------- */
    select count(*) filter (where status in ('generating', 'publishing', 'running')),
           count(*) filter (
               where status in ('generating', 'publishing', 'running')
                 and coalesce(started_at, created_at) < now() - interval '30 minutes'
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
           ),
           count(*) filter (
               where lower(coalesce(status, '')) in ('posted', 'success', 'published', 'completed', 'done')
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
           ),
           max(coalesce(finished_at, created_at)) filter (
               where lower(coalesce(status, '')) in ('posted', 'success', 'published', 'completed', 'done')
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and lower(coalesce(error_message, '')) like '%invalid_grant%'
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and (
                     lower(coalesce(error_message, '')) like '%code 368%'
                     or lower(coalesce(error_message, '')) like '%dibatasi sementara%'
                 )
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and (
                     lower(coalesce(error_message, '')) like '%kebijakan konten%'
                     or lower(coalesce(error_message, '')) like '%was rejec%'
                 )
           )
      into v_runs_active,
           v_runs_stale,
           v_runs_failed_24h,
           v_runs_success_24h,
           v_last_success_at,
           v_opus_relogin,
           v_fb_restricted,
           v_policy_rejects
      from public.social_post_runs;

    /* ---------- token Opus ---------- */
    select count(*),
           count(*) filter (where expires_at <= now()),
           min(expires_at) filter (where expires_at > now())
      into v_opus_tokens, v_opus_expired, v_opus_nearest
      from public.opus_oauth_tokens;

    /* ---------- alert ---------- */
    if v_subs_expiring > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'warning',
            'code', 'SUBSCRIPTION_EXPIRING',
            'message', v_subs_expiring || ' langganan Studio Medsos berakhir dalam 3 hari; autopost akan berhenti sendiri.'
        );
    end if;

    if v_orphan_schedules > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'SCHEDULE_WITHOUT_SUBSCRIPTION',
            'message', v_orphan_schedules || ' jadwal masih enabled padahal langganannya tidak aktif; akan di-pause pada tick cron berikutnya.'
        );
    end if;

    if v_runs_stale > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'STALE_RUNS',
            'message', v_runs_stale || ' run menggantung lebih dari 30 menit (kemungkinan worker terputus).'
        );
    end if;

    if v_opus_relogin > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'OPUS_RELOGIN_REQUIRED',
            'message', v_opus_relogin || ' run gagal karena refresh token Opus ditolak (invalid_grant). Perlu login ulang ke Opus Labs.'
        );
    end if;

    if v_fb_restricted > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'FACEBOOK_PAGE_RESTRICTED',
            'message', v_fb_restricted || ' run gagal karena Page dibatasi Facebook (code 368). Periksa Page di Facebook.'
        );
    end if;

    if v_policy_rejects > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'warning',
            'code', 'CONTENT_POLICY_REJECTED',
            'message', v_policy_rejects || ' run ditolak kebijakan konten provider; perlu ubah prompt/scene.'
        );
    end if;

    if v_runs_failed_24h > 0 and v_runs_success_24h = 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'ALL_FAILING',
            'message', v_runs_failed_24h || ' run gagal dalam 24 jam tanpa satu pun sukses; cek token Facebook, token Opus, dan kuota provider.'
        );
    end if;

    return jsonb_build_object(
        'generated_at', now(),
        'ok', jsonb_array_length(v_alerts) = 0,
        'alerts', v_alerts,
        'schedules', jsonb_build_object(
            'total', v_schedules_total,
            'enabled', v_schedules_enabled,
            'paused', v_schedules_paused
        ),
        'subscriptions', jsonb_build_object(
            'active', v_subs_active,
            'expiring_3d', v_subs_expiring,
            'expired', v_subs_expired,
            'earliest_expiry', v_earliest_expiry
        ),
        'runs', jsonb_build_object(
            'in_progress', v_runs_active,
            'stale_30m', v_runs_stale,
            'failed_24h', v_runs_failed_24h,
            'success_24h', v_runs_success_24h,
            'last_success_at', v_last_success_at,
            'opus_relogin_24h', v_opus_relogin,
            'facebook_restricted_24h', v_fb_restricted,
            'content_policy_24h', v_policy_rejects
        ),
        'opus_tokens', jsonb_build_object(
            'total', v_opus_tokens,
            'expired', v_opus_expired,
            'nearest_expiry', v_opus_nearest
        )
    );
end;
$$;

revoke all on function public.social_publisher_health() from public, anon;
grant execute on function public.social_publisher_health() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;


/* =========================================================
   VERIFIKASI

   1. Dari server / SQL editor:
      select jsonb_pretty(public.social_publisher_health());

   2. Dari client admin (JWT admin aktif) — lewat PostgREST:
      POST /rest/v1/rpc/social_publisher_health   -> 200 + jsonb

   3. Dari anon:
      POST /rest/v1/rpc/social_publisher_health   -> permission denied

   4. Dari user login non-admin:
      -> ADMIN_ONLY (42501)

   CONTOH PEMAKAIAN UNTUK ALERT (jalankan manual / scheduler):
      select public.social_publisher_health()
       where (public.social_publisher_health() ->> 'ok') = 'false';
========================================================= */
