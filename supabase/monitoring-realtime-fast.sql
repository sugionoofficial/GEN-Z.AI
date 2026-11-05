-- =========================================================
-- GEN-Z.AI — MONITORING REALTIME CEPAT
-- File: supabase/monitoring-realtime-fast.sql
-- ---------------------------------------------------------
-- Patch untuk membuat halaman monitoring respon <2 detik:
-- 1. Tambahkan monitoring_events & monitoring_findings ke realtime publication
-- 2. Buat RLS policy agar ADMIN/OWNER bisa baca via realtime channel
-- 3. Perluas ALLOWED_KINDS di check constraint (auth, account, credit)
-- Jalankan di Supabase SQL Editor (idempoten, aman diulang).
-- =========================================================

-- 1) Perluas kind yang diizinkan (auth/account/credit/injection_attempt)
alter table public.monitoring_events
    drop constraint if exists monitoring_events_kind_chk;
alter table public.monitoring_events
    add constraint monitoring_events_kind_chk
    check (kind in ('activity', 'page_view', 'error', 'devtools', 'security', 'api_failure', 'worker', 'auth', 'account', 'credit', 'injection_attempt'));

-- 2) Realtime publication
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'monitoring_events'
    ) then
        alter publication supabase_realtime add table public.monitoring_events;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'monitoring_findings'
    ) then
        alter publication supabase_realtime add table public.monitoring_findings;
    end if;
end $$;

-- 3) RLS policy realtime untuk admin/owner
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname='public' and tablename='monitoring_events' and policyname='monitoring_events_realtime_admin'
    ) then
        create policy monitoring_events_realtime_admin
            on public.monitoring_events for select
            to authenticated
            using (
                exists (
                    select 1 from public.profiles p
                    where p.id = auth.uid()
                      and lower(p.role) in ('admin','owner')
                )
            );
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname='public' and tablename='monitoring_findings' and policyname='monitoring_findings_realtime_admin'
    ) then
        create policy monitoring_findings_realtime_admin
            on public.monitoring_findings for select
            to authenticated
            using (
                exists (
                    select 1 from public.profiles p
                    where p.id = auth.uid()
                      and lower(p.role) in ('admin','owner')
                )
            );
    end if;
end $$;

-- Verifikasi: harusnya 2 baris
-- select * from pg_publication_tables where pubname='supabase_realtime' and tablename in ('monitoring_events','monitoring_findings');
