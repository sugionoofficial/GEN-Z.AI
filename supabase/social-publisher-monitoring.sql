/* =========================================================
   GEN-Z.AI — SOCIAL PUBLISHER HEALTH CHECK
   ---------------------------------------------------------
   Status: SUDAH DIJALANKAN di project ycovbqmezhrvzobxqnyp
           (GEN-Z.AI). Idempotent.

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

   CATATAN LAGU: judul lagu hasil unduhan (nama situs + bitrate) dibersihkan
   sebelum masuk caption; koleksi yang judulnya tidak layak memunculkan alert
   SONG_TITLE_NOT_CAPTION_SAFE.

   CATATAN STATUS: run Social Publisher yang sukses berstatus 'posted'
   (bukan 'success'). Kumpulan status sukses dibuat eksplisit:
   ('posted','success','published','completed','done').

   CATATAN RIWAYAT VS GANGGUAN AKTIF:
   - OPUS_RELOGIN_REQUIRED hanya diangkat sebagai error bila masih ada
     kegagalan invalid_grant SETELAH posting sukses terakhir (kalau sudah
     login ulang dan posting berikutnya sukses, riwayat lama tidak lagi
     menyuruh login ulang).
   - FACEBOOK_ACTION_REJECTED (code 368 = aksi dianggap spam/abusive oleh
     Meta, BUKAN blokir Page) dan CONTENT_POLICY_REJECTED diturunkan jadi
     catatan 'info' bila posting sesudahnya sudah kembali berhasil, sehingga
     status `ok` mencerminkan kondisi autopost saat ini.

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
    v_opus_relogin_unresolved int := 0;
    v_fb_rejected int := 0;
    v_fb_rejected_unresolved int := 0;
    v_policy_rejects int := 0;
    v_policy_unresolved int := 0;
    v_songs_total int := 0;
    v_songs_active int := 0;
    v_songs_unusable int := 0;
    v_has_problem boolean := false;
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

    /* ---------- waktu sukses terakhir ---------- */
    select max(coalesce(finished_at, created_at))
      into v_last_success_at
      from public.social_post_runs
     where lower(coalesce(status, '')) in ('posted', 'success', 'published', 'completed', 'done');

    /* ---------- run (24 jam terakhir + apakah masih belum pulih setelah sukses terakhir) ---------- */
    select count(*) filter (where lower(coalesce(status, '')) in ('generating', 'publishing', 'running')),
           count(*) filter (
               where lower(coalesce(status, '')) in ('generating', 'publishing', 'running')
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
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and lower(coalesce(error_message, '')) like '%invalid_grant%'
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and coalesce(finished_at, created_at) > coalesce(v_last_success_at, '-infinity'::timestamptz)
                 and lower(coalesce(error_message, '')) like '%invalid_grant%'
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and (
                     lower(coalesce(error_message, '')) like '%code 368%'
                     or lower(coalesce(error_message, '')) like '%ditolak facebook%'
                     or lower(coalesce(error_message, '')) like '%dibatasi sementara%'
                 )
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and coalesce(finished_at, created_at) > coalesce(v_last_success_at, '-infinity'::timestamptz)
                 and (
                     lower(coalesce(error_message, '')) like '%code 368%'
                     or lower(coalesce(error_message, '')) like '%ditolak facebook%'
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
           ),
           count(*) filter (
               where lower(coalesce(status, '')) = 'failed'
                 and coalesce(finished_at, created_at) > now() - interval '24 hours'
                 and coalesce(finished_at, created_at) > coalesce(v_last_success_at, '-infinity'::timestamptz)
                 and (
                     lower(coalesce(error_message, '')) like '%kebijakan konten%'
                     or lower(coalesce(error_message, '')) like '%was rejec%'
                 )
           )
      into v_runs_active,
           v_runs_stale,
           v_runs_failed_24h,
           v_runs_success_24h,
           v_opus_relogin,
           v_opus_relogin_unresolved,
           v_fb_rejected,
           v_fb_rejected_unresolved,
           v_policy_rejects,
           v_policy_unresolved
      from public.social_post_runs;

    /* ---------- token Opus ---------- */
    select count(*),
           count(*) filter (where expires_at <= now()),
           min(expires_at) filter (where expires_at > now())
      into v_opus_tokens, v_opus_expired, v_opus_nearest
      from public.opus_oauth_tokens;

    /* ---------- koleksi lagu ----------
       Judul lagu hasil unduhan (contoh "FDownload.app 1125438713302255 (320kbps)")
       terbaca seperti spam bila masuk caption Facebook, jadi blok lagu dihilangkan
       dari caption. Koleksi seperti ini perlu diganti judulnya di panel lagu. */
    select count(*),
           count(*) filter (where is_active),
           count(*) filter (where is_active and (
               title ~* '(fdownload|y2mate|ssyoutube|savefrom|savemp3|mp3juice|mp3skull|yt1s|yt5s|9convert|onlinevideoconverter)'
               or title ~* '(https?://|www\.)'
               or title ~* '\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4)$'
               or title ~* '[0-9]{2,3}\s*kbps'
               or title ~ '^\s*[0-9]{6,}\s*$'
           ))
      into v_songs_total, v_songs_active, v_songs_unusable
      from public.social_facebook_songs;

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

    /* Hanya minta login ulang bila invalid_grant masih terjadi SETELAH post sukses terakhir. */
    if v_opus_relogin_unresolved > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'OPUS_RELOGIN_REQUIRED',
            'message', v_opus_relogin_unresolved || ' run terbaru gagal karena refresh token Opus ditolak (invalid_grant). Perlu login ulang ke Opus Labs.'
        );
    end if;

    if v_fb_rejected_unresolved > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'warning',
            'code', 'FACEBOOK_ACTION_REJECTED',
            'message', v_fb_rejected_unresolved || ' run terbaru ditolak Facebook (code 368: aksi dianggap abusive/spam). Bukan blokir Page - periksa caption dan frekuensi post.'
        );
    elsif v_fb_rejected > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'info',
            'code', 'FACEBOOK_ACTION_REJECTED',
            'message', v_fb_rejected || ' run sempat ditolak Facebook (code 368, bukan blokir Page) dalam 24 jam terakhir, tetapi posting terbaru sudah kembali berhasil.'
        );
    end if;

    if v_policy_unresolved > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'warning',
            'code', 'CONTENT_POLICY_REJECTED',
            'message', v_policy_unresolved || ' run terbaru ditolak kebijakan konten provider; perlu ubah prompt/scene.'
        );
    elsif v_policy_rejects > 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'info',
            'code', 'CONTENT_POLICY_REJECTED',
            'message', v_policy_rejects || ' run dalam 24 jam sempat kena filter kebijakan konten provider, tetapi posting terbaru sudah kembali berhasil.'
        );
    end if;

    if v_songs_active > 0 and v_songs_unusable = v_songs_active then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'warning',
            'code', 'SONG_TITLE_NOT_CAPTION_SAFE',
            'message', v_songs_unusable || ' lagu aktif berjudul nama berkas/situs unduhan. Blok lagu otomatis dihilangkan dari caption; ganti judul lagu di panel Lagu Facebook agar fitur lagu random tetap terpakai.'
        );
    end if;

    if v_runs_failed_24h > 0 and v_runs_success_24h = 0 then
        v_alerts := v_alerts || jsonb_build_object(
            'level', 'error',
            'code', 'ALL_FAILING',
            'message', v_runs_failed_24h || ' run gagal dalam 24 jam tanpa satu pun sukses; cek token Facebook, token Opus, dan kuota provider.'
        );
    end if;

    select exists (
        select 1
          from jsonb_array_elements(v_alerts) as item
         where item ->> 'level' in ('error', 'warning')
    )
      into v_has_problem;

    return jsonb_build_object(
        'generated_at', now(),
        'ok', not v_has_problem,
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
            'opus_relogin_unresolved', v_opus_relogin_unresolved,
            'facebook_rejected_24h', v_fb_rejected,
            'facebook_rejected_unresolved', v_fb_rejected_unresolved,
            'content_policy_24h', v_policy_rejects,
            'content_policy_unresolved', v_policy_unresolved
        ),
        'songs', jsonb_build_object(
            'total', v_songs_total,
            'active', v_songs_active,
            'unusable_title', v_songs_unusable
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
