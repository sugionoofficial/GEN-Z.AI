-- =========================================================
-- GEN-Z.AI — BLACK BOX // MONITORING
-- File: supabase/monitoring-blackbox.sql
-- ---------------------------------------------------------
-- Tabel untuk halaman MONITORING di Admin Panel:
--   1. monitoring_events        — log aktivitas live + error + devtools
--   2. monitoring_health_checks — hasil pemeriksaan kesehatan web
--   3. monitoring_findings      — temuan bug/masalah + cara mengatasi
--   4. monitoring_settings      — jadwal pemeriksaan rutin & retensi
--
-- Semua tabel server-only: RLS aktif, tanpa policy untuk anon /
-- authenticated. Hanya service role (Worker) yang boleh membaca/menulis.
-- Jalankan berulang kali aman (idempotent).
-- =========================================================

create table if not exists public.monitoring_events (
    id bigserial primary key,
    occurred_at timestamp with time zone not null default now(),
    kind text not null default 'activity',
    severity text not null default 'info',
    source text not null default 'web',
    path text,
    message text,
    detail jsonb not null default '{}'::jsonb,
    ip text,
    country text,
    region text,
    city text,
    asn text,
    colo text,
    user_agent text,
    device text,
    browser text,
    os text,
    user_id uuid,
    session_id text,
    devtools_open boolean not null default false,
    handled boolean not null default false
);

alter table public.monitoring_events
    drop constraint if exists monitoring_events_kind_chk;
alter table public.monitoring_events
    add constraint monitoring_events_kind_chk
    check (kind in ('activity', 'page_view', 'error', 'devtools', 'security', 'api_failure', 'worker'));

alter table public.monitoring_events
    drop constraint if exists monitoring_events_severity_chk;
alter table public.monitoring_events
    add constraint monitoring_events_severity_chk
    check (severity in ('info', 'warn', 'error', 'critical'));

create index if not exists monitoring_events_occurred_idx
    on public.monitoring_events (occurred_at desc);
create index if not exists monitoring_events_kind_idx
    on public.monitoring_events (kind, occurred_at desc);
create index if not exists monitoring_events_severity_idx
    on public.monitoring_events (severity, occurred_at desc);
create index if not exists monitoring_events_ip_idx
    on public.monitoring_events (ip, occurred_at desc);
create index if not exists monitoring_events_devtools_idx
    on public.monitoring_events (occurred_at desc)
    where devtools_open;

create table if not exists public.monitoring_health_checks (
    id bigserial primary key,
    checked_at timestamp with time zone not null default now(),
    target text not null,
    status text not null default 'ok',
    latency_ms integer,
    detail jsonb not null default '{}'::jsonb
);

alter table public.monitoring_health_checks
    drop constraint if exists monitoring_health_checks_status_chk;
alter table public.monitoring_health_checks
    add constraint monitoring_health_checks_status_chk
    check (status in ('ok', 'warn', 'fail'));

create index if not exists monitoring_health_checks_time_idx
    on public.monitoring_health_checks (checked_at desc);
create index if not exists monitoring_health_checks_target_idx
    on public.monitoring_health_checks (target, checked_at desc);

create table if not exists public.monitoring_findings (
    id uuid primary key default gen_random_uuid(),
    fingerprint text not null unique,
    title text not null,
    category text not null default 'bug',
    severity text not null default 'warn',
    description text,
    remediation text,
    evidence jsonb not null default '{}'::jsonb,
    status text not null default 'open',
    occurrence_count integer not null default 1,
    handled_at timestamp with time zone,
    first_seen_at timestamp with time zone not null default now(),
    last_seen_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

alter table public.monitoring_findings
    add column if not exists handled_at timestamp with time zone;

alter table public.monitoring_findings
    drop constraint if exists monitoring_findings_status_chk;
alter table public.monitoring_findings
    add constraint monitoring_findings_status_chk
    check (status in ('open', 'acknowledged', 'resolved'));

alter table public.monitoring_findings
    drop constraint if exists monitoring_findings_severity_chk;
alter table public.monitoring_findings
    add constraint monitoring_findings_severity_chk
    check (severity in ('info', 'warn', 'error', 'critical'));

create index if not exists monitoring_findings_status_idx
    on public.monitoring_findings (status, last_seen_at desc);

create index if not exists monitoring_findings_handled_idx
    on public.monitoring_findings (status, handled_at desc);

create table if not exists public.monitoring_settings (
    id boolean primary key default true check (id),
    scan_interval_minutes integer not null default 15,
    retention_days integer not null default 30,
    devtools_alerts boolean not null default true,
    error_alerts boolean not null default true,
    last_scan_at timestamp with time zone,
    last_scan_status text,
    updated_at timestamp with time zone not null default now()
);

alter table public.monitoring_settings
    drop constraint if exists monitoring_settings_interval_chk;
alter table public.monitoring_settings
    add constraint monitoring_settings_interval_chk
    check (scan_interval_minutes between 1 and 1440);

alter table public.monitoring_settings
    drop constraint if exists monitoring_settings_retention_chk;
alter table public.monitoring_settings
    add constraint monitoring_settings_retention_chk
    check (retention_days between 1 and 365);

insert into public.monitoring_settings (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- RLS: server-only. Tidak ada policy => anon/authenticated
-- tidak bisa membaca maupun menulis sama sekali.
-- ---------------------------------------------------------

alter table public.monitoring_events enable row level security;
alter table public.monitoring_health_checks enable row level security;
alter table public.monitoring_findings enable row level security;
alter table public.monitoring_settings enable row level security;

revoke all on public.monitoring_events from public, anon, authenticated;
revoke all on public.monitoring_health_checks from public, anon, authenticated;
revoke all on public.monitoring_findings from public, anon, authenticated;
revoke all on public.monitoring_settings from public, anon, authenticated;

revoke all on sequence public.monitoring_events_id_seq from public, anon, authenticated;
revoke all on sequence public.monitoring_health_checks_id_seq from public, anon, authenticated;

grant all on public.monitoring_events to service_role;
grant all on public.monitoring_health_checks to service_role;
grant all on public.monitoring_findings to service_role;
grant all on public.monitoring_settings to service_role;
grant all on sequence public.monitoring_events_id_seq to service_role;
grant all on sequence public.monitoring_health_checks_id_seq to service_role;

comment on table public.monitoring_events is
    'Log aktivitas live BLACK BOX: kunjungan, error klien, pembukaan DevTools, kegagalan API.';
comment on table public.monitoring_health_checks is
    'Hasil pemeriksaan kesehatan web (web, database, auth, storage, cron, social publisher).';
comment on table public.monitoring_findings is
    'Temuan bug/masalah hasil pemeriksaan, lengkap dengan cara mengatasinya.';
comment on table public.monitoring_settings is
    'Jadwal pemeriksaan rutin dan masa simpan log monitoring.';
