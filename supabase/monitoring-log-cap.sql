-- =========================================================
-- GEN-Z.AI — BLACK BOX // MONITORING
-- File: supabase/monitoring-log-cap.sql
-- ---------------------------------------------------------
-- Log aktivitas disimpan di tabel public.monitoring_events
-- (Supabase), jadi perlu dibatasi supaya tidak tumbuh terus.
--
-- Berkas ini:
--   1. menambah kolom monitoring_settings.max_events (default 500)
--   2. membuat fungsi prune_monitoring_events(p_keep) yang hanya
--      menyisakan N baris terbaru
--
-- Aman dijalankan berulang (idempotent).
-- =========================================================

alter table public.monitoring_settings
    add column if not exists max_events integer not null default 500;

alter table public.monitoring_settings
    drop constraint if exists monitoring_settings_max_events_chk;
alter table public.monitoring_settings
    add constraint monitoring_settings_max_events_chk
    check (max_events between 50 and 10000);

comment on column public.monitoring_settings.max_events is
    'Jumlah maksimal baris monitoring_events yang disimpan. Baris terlama dihapus otomatis oleh cron.';

/*
 * Sisakan hanya baris terbaru (berdasarkan id, yang mengikuti urutan insert).
 * Dipanggil cron setiap menit dan setiap kali pemeriksaan manual selesai.
 */
create or replace function public.prune_monitoring_events(p_keep integer default 500)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_keep integer := greatest(50, least(coalesce(p_keep, 500), 10000));
    v_deleted integer := 0;
begin
    with doomed as (
        select e.id
        from public.monitoring_events e
        order by e.id desc
        offset v_keep
        limit 20000
    )
    delete from public.monitoring_events e
    using doomed d
    where e.id = d.id;

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$function$;

comment on function public.prune_monitoring_events(integer) is
    'Menyisakan N baris monitoring_events terbaru. Mengembalikan jumlah baris yang dihapus.';

revoke all on function public.prune_monitoring_events(integer) from public, anon, authenticated;
grant execute on function public.prune_monitoring_events(integer) to service_role;
