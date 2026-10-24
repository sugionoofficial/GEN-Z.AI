-- Pemulihan run autopost yang terputus (invocation worker mati mendadak, mis. saat
-- deploy atau restart): run auto yang terjebak queued/generating diklaim ulang
-- supaya alur berlanjut sampai posting, tanpa menunggu sweep gagal 30 menit.
-- Run manual (schedule_id NULL) tidak disentuh karena alurnya milik request halaman.
-- Aman dijalankan ulang (idempotent).

create or replace function public.claim_stuck_social_post_runs(
    p_now timestamp with time zone default now(),
    p_limit integer default 2
)
returns table(run_id uuid, schedule_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_run record;
    v_limit integer := greatest(1, least(coalesce(p_limit, 2), 5));
begin
    for v_run in
        select r.id, r.schedule_id
        from public.social_post_runs r
        where r.schedule_id is not null
          and r.created_at > p_now - interval '30 minutes'
          and (
              (r.status = 'queued' and r.created_at < p_now - interval '100 seconds')
              or (
                  r.status = 'generating'
                  and coalesce(r.started_at, r.created_at) < p_now - interval '10 minutes'
              )
          )
        order by r.created_at asc
        limit v_limit
        for update skip locked
    loop
        update public.social_post_runs
        set status = 'generating',
            started_at = p_now,
            updated_at = p_now
        where id = v_run.id;

        run_id := v_run.id;
        schedule_id := v_run.schedule_id;
        return next;
    end loop;
end;
$function$;
