-- =========================================================
-- GEN-Z.AI
-- ACCOUNT DELETION REQUESTS
-- File: supabase/account-deletion-requests.sql
-- ---------------------------------------------------------
-- Tabel permintaan penghapusan akun + data.
--
-- Alur:
--   1. User mengajukan permintaan dari /user/profile.html
--      (lewat API /api/account, service role).
--   2. Permintaan berstatus 'pending'.
--   3. Admin meninjau di panel admin (status 'reviewed' /
--      'completed' / 'rejected'), atau user membatalkan sendiri
--      sehingga statusnya 'cancelled'.
--
-- Satu user hanya boleh punya satu permintaan 'pending'
-- (dijaga partial unique index).
-- =========================================================

create table if not exists public.account_deletion_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    email text,
    reason text not null,
    note text,
    status text not null default 'pending'
        check (status in ('pending', 'cancelled', 'reviewed', 'completed', 'rejected')),
    requested_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid
);

create index if not exists account_deletion_requests_user_idx
    on public.account_deletion_requests (user_id, requested_at desc);

create unique index if not exists account_deletion_requests_one_pending
    on public.account_deletion_requests (user_id)
    where status = 'pending';

alter table public.account_deletion_requests enable row level security;

grant select, insert, update on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;


/* =========================================================
   POLICIES
========================================================= */

drop policy if exists account_deletion_requests_select_own
    on public.account_deletion_requests;

create policy account_deletion_requests_select_own
    on public.account_deletion_requests
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists account_deletion_requests_insert_own
    on public.account_deletion_requests;

create policy account_deletion_requests_insert_own
    on public.account_deletion_requests
    for insert
    to authenticated
    with check (auth.uid() = user_id and status = 'pending');

drop policy if exists account_deletion_requests_update_own
    on public.account_deletion_requests;

create policy account_deletion_requests_update_own
    on public.account_deletion_requests
    for update
    to authenticated
    using (auth.uid() = user_id and status = 'pending')
    with check (auth.uid() = user_id and status in ('pending', 'cancelled'));

drop policy if exists account_deletion_requests_select_admin
    on public.account_deletion_requests;

create policy account_deletion_requests_select_admin
    on public.account_deletion_requests
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and lower(coalesce(p.role, '')) in ('admin', 'owner')
        )
    );
