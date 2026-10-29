/* =========================================================
   GEN-Z.AI — CREDIT CHANGE AUDIT TRAIL
   ---------------------------------------------------------
   Status: SUDAH DIJALANKAN di project ycovbqmezhrvzobxqnyp
           (GEN-Z.AI) pada 2026-10-29. Idempotent.

   LATAR BELAKANG
   Audit log Postgres Supabase masih OFF
   (`audit_log_disable_postgres = true` di auth config), jadi
   tidak ada jejak siapa mengubah public.profiles.credits.
   Tanpa jejak, investigasi kebocoran kredit / refund palsu
   tidak mungkin dilakukan.

   File ini menambahkan audit trail khusus kredit:

   1. public.credit_change_audit
      - satu baris setiap kali kolom credits berubah
      - menyimpan saldo sebelum/sesudah, delta, role database
        pemanggil (anon / authenticated / service_role),
        auth.uid() dari JWT, dan waktu
      - RLS aktif, hanya admin (is_admin_or_owner) + service
        role yang bisa membaca; anon/authenticated dicabut

   2. Trigger BEFORE (public.guard_profile_credits)
      - SECURITY INVOKER supaya `current_user` = role pemanggil
        asli (kalau DEFINER, current_user jadi owner dan guard
        tidak akan pernah terpicu)
      - menolak perubahan credits dari anon/authenticated
        -> error 42501 CREDITS_READ_ONLY
      - meneruskan role pemanggil lewat GUC `genz.credit_writer`

   3. Trigger AFTER (public.log_credit_changes)
      - SECURITY DEFINER, menulis baris audit memakai role yang
        diteruskan trigger BEFORE

   CATATAN KEJUJURAN
   Percobaan tulis yang DITOLAK tidak menghasilkan baris audit,
   karena statement yang gagal ikut ter-rollback (Postgres tidak
   punya autonomous transaction tanpa extension seperti dblink).
   Yang tercatat adalah perubahan yang benar-benar diterapkan.
   Untuk mencatat percobaan yang gagal, aktifkan audit log
   Postgres di Dashboard Supabase:
     Project Settings → Authentication → Advanced/Logging
   (setelan `audit_log_disable_postgres` = false)
========================================================= */

begin;

create table if not exists public.credit_change_audit (
    id bigserial primary key,
    profile_id uuid not null,
    old_credits numeric,
    new_credits numeric,
    delta numeric,
    blocked boolean not null default false,
    db_user text,
    auth_uid uuid,
    source text,
    changed_at timestamptz not null default now()
);

create index if not exists idx_credit_audit_profile_time
    on public.credit_change_audit (profile_id, changed_at desc);

create index if not exists idx_credit_audit_blocked
    on public.credit_change_audit (blocked, changed_at desc);

alter table public.credit_change_audit enable row level security;

revoke all on table public.credit_change_audit from public, anon, authenticated;
grant select on table public.credit_change_audit to service_role;
grant usage, select on sequence public.credit_change_audit_id_seq to service_role;

drop policy if exists "Admins can read credit audit" on public.credit_change_audit;

create policy "Admins can read credit audit"
    on public.credit_change_audit
    for select
    to authenticated
    using (public.is_admin_or_owner());

/* ---------------------------------------------------------
   Helper: ambil auth.uid() dari klaim JWT PostgREST
--------------------------------------------------------- */

create or replace function public.genz_current_jwt_uid()
returns uuid
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
declare
    v_claims text;
begin
    v_claims := current_setting('request.jwt.claims', true);

    if v_claims is null or v_claims = '' then
        return null;
    end if;

    return nullif(v_claims::json ->> 'sub', '')::uuid;
exception when others then
    return null;
end;
$$;

grant execute on function public.genz_current_jwt_uid() to anon, authenticated, service_role;

/* ---------------------------------------------------------
   Helper: penulis baris audit (dipanggil kedua trigger)
--------------------------------------------------------- */

create or replace function public.credit_audit_insert(
    p_profile_id uuid,
    p_old numeric,
    p_new numeric,
    p_blocked boolean,
    p_db_user text,
    p_source text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    insert into public.credit_change_audit (
        profile_id, old_credits, new_credits, delta, blocked,
        db_user, auth_uid, source
    )
    values (
        p_profile_id, p_old, p_new,
        coalesce(p_new, 0) - coalesce(p_old, 0),
        p_blocked, p_db_user, public.genz_current_jwt_uid(), p_source
    );
end;
$$;

revoke all on function public.credit_audit_insert(uuid, numeric, numeric, boolean, text, text)
    from public, anon, authenticated;

/* ---------------------------------------------------------
   Trigger BEFORE — guard (SECURITY INVOKER!)
--------------------------------------------------------- */

create or replace function public.guard_profile_credits()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
    v_caller text := current_user;
begin
    if new.credits is distinct from old.credits then

        if v_caller in ('anon', 'authenticated') then
            raise exception 'CREDITS_READ_ONLY'
                using errcode = '42501',
                      hint = 'Kredit hanya bisa diubah lewat endpoint/RPC server (service_role).';
        end if;

        -- diteruskan ke trigger AFTER lewat GUC lokal transaksi
        perform set_config('genz.credit_writer', v_caller, true);
    end if;

    return new;
end;
$$;

drop trigger if exists guard_profile_credits_trg on public.profiles;

create trigger guard_profile_credits_trg
before update on public.profiles
for each row
execute function public.guard_profile_credits();

revoke all on function public.guard_profile_credits() from public, anon, authenticated;

/* ---------------------------------------------------------
   Trigger AFTER — pencatat
--------------------------------------------------------- */

create or replace function public.log_credit_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if new.credits is distinct from old.credits then
        perform public.credit_audit_insert(
            new.id,
            old.credits,
            new.credits,
            false,
            coalesce(nullif(current_setting('genz.credit_writer', true), ''), 'unknown'),
            'applied'
        );
    end if;

    return null;
end;
$$;

drop trigger if exists log_credit_changes_trg on public.profiles;

create trigger log_credit_changes_trg
after update on public.profiles
for each row
execute function public.log_credit_changes();

revoke all on function public.log_credit_changes() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;


/* =========================================================
   VERIFIKASI

   1. Dari server (service_role) — harus tercatat:

      begin;
      set local role service_role;
      update public.profiles set credits = coalesce(credits,0) + 1
       where id = '<uuid>';
      update public.profiles set credits = coalesce(credits,0) - 1
       where id = '<uuid>';
      reset role;
      select id, profile_id, old_credits, new_credits, delta, db_user, source
        from public.credit_change_audit order by id desc limit 2;
      rollback;
      -- db_user harus 'service_role'

   2. Dari client — harus ditolak (butuh policy UPDATE untuk
      benar-benar sampai ke trigger; RLS biasanya sudah lebih
      dulu menolak dengan 0 baris):

      CREDITS_READ_ONLY | sqlstate=42501

   3. Query monitoring yang disarankan:

      -- perubahan kredit besar dalam 24 jam
      select * from public.credit_change_audit
       where changed_at > now() - interval '24 hours'
         and abs(delta) >= 1000
       order by changed_at desc;

      -- perubahan yang bukan dari server
      select * from public.credit_change_audit
       where db_user not in ('service_role','postgres')
       order by changed_at desc;
========================================================= */
