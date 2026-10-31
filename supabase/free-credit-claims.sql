/* =========================================================
   GEN-Z.AI — CLAIM FREE CREDIT 5.000 GRATIS (ANTI MULTI-CLAIM)
   ---------------------------------------------------------
   Fitur:
   - Klaim 5.000 kredit gratis hanya 1 kali.
   - Ditolak bila terdapat kesamaan pada SALAH SATU dari:
       1. Akun / User ID yang sama
       2. Email yang sama (termasuk alias titik/plus Gmail)
       3. Alamat IP ( atau subnet IPv6 /64 ) yang sama
       4. Password yang sama (diverifikasi ke bcrypt auth.users
          lalu di-hash deterministik HMAC-SHA256 ber-pepper server;
          password mentah TIDAK PERNAH disimpan)
       5. Browser yang sama (browser_install_id maupun hardware/canvas/
          webgl/audio browser_fingerprint yang sama, termasuk riwayat
          sinyal saat register / login / reset password)
   - Seluruh klaim berhasil (`free_credit_claims`), seluruh percobaan
     klaim ditolak/berhasil (`free_credit_claim_attempts`), sinyal
     keamanan akun (`free_credit_user_signals`), mutasi transaksi
     (`credit_transactions`), dan jejak perubahan saldo
     (`credit_change_audit`) tercatat di Supabase.
   - Seluruh tabel & RPC dikunci dengan RLS + EXECUTE khusus
     `service_role` (selaras `supabase/credit-rpc-hardening.sql`).
========================================================= */

begin;

/* ---------------------------------------------------------
   1. PERLUAS TIPE TRANSAKSI KREDIT (`free_claim`)
--------------------------------------------------------- */

alter table public.credit_transactions
    drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
    add constraint credit_transactions_type_check
    check (
        type = any (
            array[
                'topup'::text,
                'admin_add'::text,
                'admin_remove'::text,
                'generation'::text,
                'refund'::text,
                'adjustment'::text,
                'free_claim'::text
            ]
        )
    );

/* ---------------------------------------------------------
   2. SECRET PEPPER SERVER UNTUK HMAC PASSWORD FINGERPRINT
      (Hanya bisa diakses SECURITY DEFINER / service_role)
--------------------------------------------------------- */

create table if not exists public.free_credit_secret_config (
    id smallint primary key check (id = 1),
    password_pepper text not null,
    created_at timestamptz not null default now()
);

alter table public.free_credit_secret_config enable row level security;

revoke all on table public.free_credit_secret_config from public, anon, authenticated;
grant select on table public.free_credit_secret_config to service_role;

insert into public.free_credit_secret_config (id, password_pepper)
values (1, encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

/* ---------------------------------------------------------
   2B. KONFIGURASI ON/OFF & BANNER 16:9 CLAIM FREE CREDIT 5.000
       (Dikelola dari halaman Monitoring oleh ADMIN / OWNER)
--------------------------------------------------------- */

create table if not exists public.free_credit_settings (
    id smallint primary key default 1 check (id = 1),
    claim_enabled boolean not null default true,
    banner_image_url text,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

alter table public.free_credit_settings
    add column if not exists claim_enabled boolean not null default true,
    add column if not exists banner_image_url text,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.free_credit_settings enable row level security;

revoke all on table public.free_credit_settings from public, anon, authenticated;
grant select on table public.free_credit_settings to authenticated;
grant all on table public.free_credit_settings to service_role;

drop policy if exists "Admins can read free credit settings" on public.free_credit_settings;
create policy "Admins can read free credit settings"
    on public.free_credit_settings
    for select
    to authenticated
    using (public.is_admin_or_owner());

insert into public.free_credit_settings (id, claim_enabled)
values (1, true)
on conflict (id) do nothing;

/* ---------------------------------------------------------
   3. HELPER NORMALISASI EMAIL & HMAC PASSWORD
--------------------------------------------------------- */

create or replace function public.normalize_free_credit_email(p_email text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
    v_clean text;
    v_at integer;
    v_local text;
    v_domain text;
begin
    v_clean := lower(btrim(coalesce(p_email, '')));
    if v_clean = '' then
        return '';
    end if;

    v_at := position('@' in v_clean);
    if v_at <= 1 or v_at >= length(v_clean) then
        return v_clean;
    end if;

    v_local := substring(v_clean from 1 for v_at - 1);
    v_domain := substring(v_clean from v_at + 1);

    if v_domain = 'googlemail.com' then
        v_domain := 'gmail.com';
    end if;

    -- Buang subaddressing +tag (mis. user+promo2@domain.com -> user@domain.com)
    v_local := split_part(v_local, '+', 1);

    -- Untuk Gmail, titik sebelum @ diabaikan oleh Google (a.b.c@gmail.com = abc@gmail.com)
    if v_domain = 'gmail.com' then
        v_local := replace(v_local, '.', '');
    end if;

    if v_local = '' then
        return v_clean;
    end if;

    return v_local || '@' || v_domain;
end;
$$;

revoke all on function public.normalize_free_credit_email(text) from public, anon, authenticated;
grant execute on function public.normalize_free_credit_email(text) to service_role;

create or replace function public.compute_free_credit_password_hash(p_password text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_pepper text;
begin
    if p_password is null or p_password = '' then
        return null;
    end if;

    select password_pepper
      into v_pepper
      from public.free_credit_secret_config
     where id = 1;

    if v_pepper is null or v_pepper = '' then
        raise exception 'FREE_CREDIT_PEPPER_MISSING';
    end if;

    return encode(
        extensions.hmac(
            convert_to(p_password, 'UTF8'),
            decode(v_pepper, 'hex'),
            'sha256'
        ),
        'hex'
    );
end;
$$;

revoke all on function public.compute_free_credit_password_hash(text) from public, anon, authenticated;
grant execute on function public.compute_free_credit_password_hash(text) to service_role;

/* ---------------------------------------------------------
   4. TABEL RIWAYAT SINYAL KEAMANAN AKUN
      (Direkam saat register, login, reset password, dan klaim)
--------------------------------------------------------- */

create table if not exists public.free_credit_user_signals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    email_exact text not null,
    email_canonical text not null,
    signal_source text not null check (
        signal_source in ('register', 'login', 'password_reset', 'claim')
    ),
    ip_address text,
    ip_subnet text,
    password_hash text,
    browser_fingerprint text,
    browser_install_id text,
    user_agent text,
    browser_summary text,
    created_at timestamptz not null default now()
);

create index if not exists idx_fc_signals_user_time
    on public.free_credit_user_signals (user_id, created_at desc);

create index if not exists idx_fc_signals_ip
    on public.free_credit_user_signals (ip_address)
    where ip_address is not null;

create index if not exists idx_fc_signals_ip_subnet
    on public.free_credit_user_signals (ip_subnet)
    where ip_subnet is not null;

create index if not exists idx_fc_signals_pw_hash
    on public.free_credit_user_signals (password_hash)
    where password_hash is not null;

create index if not exists idx_fc_signals_bfp
    on public.free_credit_user_signals (browser_fingerprint)
    where browser_fingerprint is not null;

create index if not exists idx_fc_signals_bid
    on public.free_credit_user_signals (browser_install_id)
    where browser_install_id is not null;

alter table public.free_credit_user_signals enable row level security;

revoke all on table public.free_credit_user_signals from public, anon, authenticated;
grant select on table public.free_credit_user_signals to authenticated;
grant all on table public.free_credit_user_signals to service_role;

drop policy if exists "Admins can read free credit signals" on public.free_credit_user_signals;
create policy "Admins can read free credit signals"
    on public.free_credit_user_signals
    for select
    to authenticated
    using (public.is_admin_or_owner());

/* ---------------------------------------------------------
   5. TABEL UTAMA KLAIM FREE CREDIT 5.000 GRATIS
      (Permanen; ON DELETE SET NULL pada user_id agar hapus akun
       tidak menghapus jejak email/IP/password/browser yang sudah klaim)
--------------------------------------------------------- */

create table if not exists public.free_credit_claims (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    claimed_user_id uuid not null,
    email_exact text not null,
    email_canonical text not null,
    ip_address text not null,
    ip_subnet text,
    password_hash text not null,
    browser_fingerprint text not null,
    browser_install_id text not null,
    user_agent text,
    browser_summary text,
    country text,
    city text,
    credit_amount integer not null default 5000 check (credit_amount = 5000),
    balance_before integer not null,
    balance_after integer not null,
    claimed_at timestamptz not null default now()
);

create unique index if not exists uq_free_credit_claims_claimed_user
    on public.free_credit_claims (claimed_user_id);

create unique index if not exists uq_free_credit_claims_email_exact
    on public.free_credit_claims (email_exact);

create unique index if not exists uq_free_credit_claims_email_canonical
    on public.free_credit_claims (email_canonical);

create unique index if not exists uq_free_credit_claims_ip_address
    on public.free_credit_claims (ip_address);

create unique index if not exists uq_free_credit_claims_ip_subnet
    on public.free_credit_claims (ip_subnet)
    where ip_subnet is not null;

create unique index if not exists uq_free_credit_claims_password_hash
    on public.free_credit_claims (password_hash);

create unique index if not exists uq_free_credit_claims_browser_fp
    on public.free_credit_claims (browser_fingerprint);

create unique index if not exists uq_free_credit_claims_browser_install
    on public.free_credit_claims (browser_install_id);

create index if not exists idx_free_credit_claims_time
    on public.free_credit_claims (claimed_at desc);

alter table public.free_credit_claims enable row level security;

revoke all on table public.free_credit_claims from public, anon, authenticated;
grant select on table public.free_credit_claims to authenticated;
grant all on table public.free_credit_claims to service_role;

drop policy if exists "Admins can read all free credit claims" on public.free_credit_claims;
create policy "Admins can read all free credit claims"
    on public.free_credit_claims
    for select
    to authenticated
    using (public.is_admin_or_owner());

/* ---------------------------------------------------------
   6. TABEL LOG SELURUH PERCOBAAN KLAIM (BERHASIL & DITOLAK)
--------------------------------------------------------- */

create table if not exists public.free_credit_claim_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    attempted_user_id uuid,
    email_exact text,
    email_canonical text,
    ip_address text,
    ip_subnet text,
    password_hash text,
    browser_fingerprint text,
    browser_install_id text,
    user_agent text,
    browser_summary text,
    country text,
    city text,
    status text not null check (status in ('granted', 'rejected')),
    rejection_reason text,
    matched_reasons text[] not null default '{}',
    matched_claim_id uuid references public.free_credit_claims(id) on delete set null,
    claim_id uuid references public.free_credit_claims(id) on delete set null,
    attempted_at timestamptz not null default now()
);

create index if not exists idx_fc_attempts_time
    on public.free_credit_claim_attempts (attempted_at desc);

create index if not exists idx_fc_attempts_user
    on public.free_credit_claim_attempts (attempted_user_id, attempted_at desc);

create index if not exists idx_fc_attempts_status
    on public.free_credit_claim_attempts (status, attempted_at desc);

alter table public.free_credit_claim_attempts enable row level security;

revoke all on table public.free_credit_claim_attempts from public, anon, authenticated;
grant select on table public.free_credit_claim_attempts to authenticated;
grant all on table public.free_credit_claim_attempts to service_role;

drop policy if exists "Admins can read free credit claim attempts" on public.free_credit_claim_attempts;
create policy "Admins can read free credit claim attempts"
    on public.free_credit_claim_attempts
    for select
    to authenticated
    using (public.is_admin_or_owner());

/* ---------------------------------------------------------
   7. RPC: REKAM SINYAL REGISTER / LOGIN / RESET PASSWORD
      Memverifikasi password terhadap bcrypt `auth.users.encrypted_password`
      sehingga tidak bisa dipalsukan oleh pihak lain.
--------------------------------------------------------- */

create or replace function public.record_free_credit_auth_signal(
    p_user_id uuid default null,
    p_email text default null,
    p_password text default null,
    p_source text default 'login',
    p_ip_address text default null,
    p_ip_subnet text default null,
    p_browser_fingerprint text default null,
    p_browser_install_id text default null,
    p_user_agent text default null,
    p_browser_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_user_id uuid;
    v_user_email text;
    v_encrypted_pw text;
    v_is_anon boolean;
    v_email_exact text;
    v_email_canonical text;
    v_pw_hash text := null;
    v_source text := lower(btrim(coalesce(p_source, 'login')));
    v_ip text := nullif(btrim(coalesce(p_ip_address, '')), '');
    v_subnet text := nullif(btrim(coalesce(p_ip_subnet, '')), '');
    v_bfp text := nullif(btrim(coalesce(p_browser_fingerprint, '')), '');
    v_bid text := nullif(btrim(coalesce(p_browser_install_id, '')), '');
    v_ua text := nullif(left(btrim(coalesce(p_user_agent, '')), 500), '');
    v_bsum text := nullif(left(btrim(coalesce(p_browser_summary, '')), 160), '');
begin
    if v_source not in ('register', 'login', 'password_reset', 'claim') then
        v_source := 'login';
    end if;

    if p_user_id is not null then
        select u.id, u.email, u.encrypted_password, coalesce(u.is_anonymous, false)
          into v_user_id, v_user_email, v_encrypted_pw, v_is_anon
          from auth.users u
         where u.id = p_user_id
           and u.deleted_at is null
         limit 1;
    elsif nullif(btrim(coalesce(p_email, '')), '') is not null then
        select u.id, u.email, u.encrypted_password, coalesce(u.is_anonymous, false)
          into v_user_id, v_user_email, v_encrypted_pw, v_is_anon
          from auth.users u
         where lower(btrim(u.email)) = lower(btrim(p_email))
           and u.deleted_at is null
         order by u.created_at desc
         limit 1;
    end if;

    if v_user_id is null or v_is_anon or coalesce(v_user_email, '') = '' then
        return jsonb_build_object('ok', false, 'code', 'user_not_found');
    end if;

    if p_password is not null and p_password <> '' then
        if v_encrypted_pw is null or v_encrypted_pw = ''
           or extensions.crypt(p_password, v_encrypted_pw) is distinct from v_encrypted_pw then
            return jsonb_build_object('ok', false, 'code', 'invalid_password');
        end if;
        v_pw_hash := public.compute_free_credit_password_hash(p_password);
    elsif p_user_id is null then
        -- Tanpa JWT user_id terverifikasi, wajib menyertakan password yang valid
        return jsonb_build_object('ok', false, 'code', 'password_required');
    end if;

    v_email_exact := lower(btrim(v_user_email));
    v_email_canonical := public.normalize_free_credit_email(v_user_email);

    -- Hindari duplikasi baris sinyal identik beruntun untuk user yang sama
    if exists (
        select 1
          from public.free_credit_user_signals s
         where s.user_id = v_user_id
           and s.ip_address is not distinct from v_ip
           and s.password_hash is not distinct from v_pw_hash
           and s.browser_fingerprint is not distinct from v_bfp
           and s.browser_install_id is not distinct from v_bid
           and s.created_at > now() - interval '12 hours'
    ) then
        return jsonb_build_object(
            'ok', true,
            'deduplicated', true,
            'has_password_signal', (v_pw_hash is not null)
        );
    end if;

    insert into public.free_credit_user_signals (
        user_id,
        email_exact,
        email_canonical,
        signal_source,
        ip_address,
        ip_subnet,
        password_hash,
        browser_fingerprint,
        browser_install_id,
        user_agent,
        browser_summary
    )
    values (
        v_user_id,
        v_email_exact,
        v_email_canonical,
        v_source,
        v_ip,
        v_subnet,
        v_pw_hash,
        v_bfp,
        v_bid,
        v_ua,
        v_bsum
    );

    return jsonb_build_object(
        'ok', true,
        'deduplicated', false,
        'has_password_signal', (v_pw_hash is not null)
    );
end;
$$;

revoke all on function public.record_free_credit_auth_signal(
    uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_free_credit_auth_signal(
    uuid, text, text, text, text, text, text, text, text, text
) to service_role;

/* ---------------------------------------------------------
   8. RPC: CEK STATUS KLAIM UNTUK USER YANG SEDANG LOGIN
--------------------------------------------------------- */

create or replace function public.get_free_credit_claim_status(
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_claim record;
    v_settings record;
    v_has_pw boolean := false;
    v_enabled boolean := true;
    v_banner_url text := null;
begin
    if p_user_id is null then
        return jsonb_build_object('ok', false, 'code', 'unauthorized');
    end if;

    select s.claim_enabled, s.banner_image_url
      into v_settings
      from public.free_credit_settings s
     where s.id = 1
     limit 1;

    if found then
        v_enabled := coalesce(v_settings.claim_enabled, true);
        v_banner_url := nullif(btrim(coalesce(v_settings.banner_image_url, '')), '');
    end if;

    select c.id, c.credit_amount, c.claimed_at
      into v_claim
      from public.free_credit_claims c
     where c.claimed_user_id = p_user_id
     limit 1;

    select exists (
        select 1
          from public.free_credit_user_signals s
         where s.user_id = p_user_id
           and s.password_hash is not null
    ) into v_has_pw;

    return jsonb_build_object(
        'ok', true,
        'claim_enabled', v_enabled,
        'banner_image_url', v_banner_url,
        'credit_amount', 5000,
        'claimed', (v_claim.id is not null),
        'claimed_at', v_claim.claimed_at,
        'has_password_signal', v_has_pw
    );
end;
$$;

revoke all on function public.get_free_credit_claim_status(uuid) from public, anon, authenticated;
grant execute on function public.get_free_credit_claim_status(uuid) to service_role;

/* ---------------------------------------------------------
   9. RPC ATOMIK: CLAIM FREE CREDIT 5.000 GRATIS
--------------------------------------------------------- */

create or replace function public.claim_free_credit_5000(
    p_user_id uuid,
    p_password text default null,
    p_ip_address text default null,
    p_ip_subnet text default null,
    p_browser_fingerprint text default null,
    p_browser_install_id text default null,
    p_user_agent text default null,
    p_browser_summary text default null,
    p_country text default null,
    p_city text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_reward constant integer := 5000;
    v_user record;
    v_profile record;
    v_email_exact text;
    v_email_canonical text;
    v_ip text := nullif(btrim(coalesce(p_ip_address, '')), '');
    v_subnet text := nullif(btrim(coalesce(p_ip_subnet, '')), '');
    v_bfp text := nullif(btrim(coalesce(p_browser_fingerprint, '')), '');
    v_bid text := nullif(btrim(coalesce(p_browser_install_id, '')), '');
    v_ua text := nullif(left(btrim(coalesce(p_user_agent, '')), 500), '');
    v_bsum text := nullif(left(btrim(coalesce(p_browser_summary, '')), 160), '');
    v_country text := nullif(left(btrim(coalesce(p_country, '')), 32), '');
    v_city text := nullif(left(btrim(coalesce(p_city, '')), 120), '');
    v_pw_hash text := null;
    v_all_ips text[];
    v_all_subnets text[];
    v_all_pws text[];
    v_all_bfps text[];
    v_all_bids text[];
    v_reasons text[] := array[]::text[];
    v_primary_reason text := null;
    v_matched_claim_id uuid := null;
    v_tmp_claim_id uuid := null;
    v_claim_id uuid;
    v_new_balance integer;
    v_claim_enabled boolean := true;
begin
    -- Kunci serialisasi atomik agar klaim paralel serentak tidak pernah lolos ganda
    perform pg_advisory_xact_lock(75005000);

    if p_user_id is null then
        return jsonb_build_object('ok', false, 'code', 'unauthorized');
    end if;

    -- Cek sakelar On/Off global dari halaman Monitoring
    select coalesce(s.claim_enabled, true)
      into v_claim_enabled
      from public.free_credit_settings s
     where s.id = 1
     limit 1;

    if not coalesce(v_claim_enabled, true) then
        select u.id, u.email
          into v_user
          from auth.users u
         where u.id = p_user_id
         limit 1;

        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons
        ) values (
            case when v_user.id is not null then p_user_id else null end,
            p_user_id,
            nullif(lower(btrim(coalesce(v_user.email, ''))), ''),
            nullif(public.normalize_free_credit_email(v_user.email), ''),
            v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
            'rejected', 'feature_disabled', array['feature_disabled']
        );

        return jsonb_build_object(
            'ok', false,
            'code', 'feature_disabled',
            'matched_reasons', array['feature_disabled']
        );
    end if;

    select u.id,
           u.email,
           u.encrypted_password,
           u.email_confirmed_at,
           coalesce(u.is_anonymous, false) as is_anonymous,
           u.deleted_at
      into v_user
      from auth.users u
     where u.id = p_user_id
     limit 1;

    if v_user.id is null or v_user.deleted_at is not null or v_user.is_anonymous then
        return jsonb_build_object('ok', false, 'code', 'account_ineligible');
    end if;

    if coalesce(btrim(v_user.email), '') = '' or v_user.email_confirmed_at is null then
        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons
        ) values (
            p_user_id, p_user_id, lower(btrim(coalesce(v_user.email, ''))),
            public.normalize_free_credit_email(v_user.email),
            v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
            'rejected', 'unverified_email', array['unverified_email']
        );
        return jsonb_build_object('ok', false, 'code', 'unverified_email');
    end if;

    v_email_exact := lower(btrim(v_user.email));
    v_email_canonical := public.normalize_free_credit_email(v_user.email);

    select p.id, p.credits, p.status
      into v_profile
      from public.profiles p
     where p.id = p_user_id
     for update;

    if v_profile.id is null or lower(coalesce(v_profile.status, '')) <> 'active' then
        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons
        ) values (
            p_user_id, p_user_id, v_email_exact, v_email_canonical,
            v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
            'rejected', 'account_inactive', array['account_inactive']
        );
        return jsonb_build_object('ok', false, 'code', 'account_inactive');
    end if;

    -- Validasi kelengkapan sinyal jaringan & browser
    if v_ip is null or v_bfp is null or v_bid is null then
        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons
        ) values (
            p_user_id, p_user_id, v_email_exact, v_email_canonical,
            v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
            'rejected', 'missing_security_signals', array['missing_security_signals']
        );
        return jsonb_build_object('ok', false, 'code', 'missing_security_signals');
    end if;

    -- Cek lebih dulu apakah user ini sendiri sudah pernah klaim
    select c.id
      into v_tmp_claim_id
      from public.free_credit_claims c
     where c.claimed_user_id = p_user_id
     limit 1;

    if v_tmp_claim_id is not null then
        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons, matched_claim_id
        ) values (
            p_user_id, p_user_id, v_email_exact, v_email_canonical,
            v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
            'rejected', 'already_claimed_user', array['already_claimed_user'], v_tmp_claim_id
        );
        return jsonb_build_object(
            'ok', false,
            'code', 'already_claimed_user',
            'matched_reasons', array['already_claimed_user']
        );
    end if;

    -- Resolusi password_hash: verifikasi password jika dikirim, atau ambil dari sinyal login/register
    if p_password is not null and p_password <> '' then
        if v_user.encrypted_password is null or v_user.encrypted_password = ''
           or extensions.crypt(p_password, v_user.encrypted_password) is distinct from v_user.encrypted_password then
            insert into public.free_credit_claim_attempts (
                user_id, attempted_user_id, email_exact, email_canonical,
                ip_address, ip_subnet, browser_fingerprint, browser_install_id,
                user_agent, browser_summary, country, city,
                status, rejection_reason, matched_reasons
            ) values (
                p_user_id, p_user_id, v_email_exact, v_email_canonical,
                v_ip, v_subnet, v_bfp, v_bid, v_ua, v_bsum, v_country, v_city,
                'rejected', 'invalid_password', array['invalid_password']
            );
            return jsonb_build_object('ok', false, 'code', 'invalid_password');
        end if;

        v_pw_hash := public.compute_free_credit_password_hash(p_password);
    else
        select s.password_hash
          into v_pw_hash
          from public.free_credit_user_signals s
         where s.user_id = p_user_id
           and s.password_hash is not null
         order by s.created_at desc
         limit 1;
    end if;

    -- Bila sesi lama belum pernah merekam sinyal password, minta verifikasi password 1x
    -- tanpa mencatat sebagai penolakan permanen.
    if v_pw_hash is null then
        return jsonb_build_object('ok', false, 'code', 'password_required');
    end if;

    -- Rekam sinyal saat klaim ke riwayat akun
    insert into public.free_credit_user_signals (
        user_id, email_exact, email_canonical, signal_source,
        ip_address, ip_subnet, password_hash,
        browser_fingerprint, browser_install_id, user_agent, browser_summary
    ) values (
        p_user_id, v_email_exact, v_email_canonical, 'claim',
        v_ip, v_subnet, v_pw_hash,
        v_bfp, v_bid, v_ua, v_bsum
    );

    -- Kumpulkan seluruh sinyal historis + saat ini milik akun pemohon
    select array_agg(distinct x) filter (where x is not null)
      into v_all_ips
      from (
          select v_ip as x
          union all
          select s.ip_address from public.free_credit_user_signals s where s.user_id = p_user_id
      ) q;

    select array_agg(distinct x) filter (where x is not null)
      into v_all_subnets
      from (
          select v_subnet as x
          union all
          select s.ip_subnet from public.free_credit_user_signals s where s.user_id = p_user_id
      ) q;

    select array_agg(distinct x) filter (where x is not null)
      into v_all_pws
      from (
          select v_pw_hash as x
          union all
          select s.password_hash from public.free_credit_user_signals s where s.user_id = p_user_id
      ) q;

    select array_agg(distinct x) filter (where x is not null)
      into v_all_bfps
      from (
          select v_bfp as x
          union all
          select s.browser_fingerprint from public.free_credit_user_signals s where s.user_id = p_user_id
      ) q;

    select array_agg(distinct x) filter (where x is not null)
      into v_all_bids
      from (
          select v_bid as x
          union all
          select s.browser_install_id from public.free_credit_user_signals s where s.user_id = p_user_id
      ) q;

    -- CEK 1: Kesamaan Email (exact maupun canonical)
    select c.id
      into v_tmp_claim_id
      from public.free_credit_claims c
     where c.email_exact = v_email_exact
        or c.email_canonical = v_email_canonical
     limit 1;

    if v_tmp_claim_id is not null then
        v_reasons := array_append(v_reasons, 'duplicate_email');
        v_matched_claim_id := coalesce(v_matched_claim_id, v_tmp_claim_id);
    end if;

    -- CEK 2: Kesamaan IP / Subnet IPv6 (langsung di free_credit_claims atau riwayat user yang sudah klaim)
    v_tmp_claim_id := null;
    select c.id
      into v_tmp_claim_id
      from public.free_credit_claims c
     where c.ip_address = any(v_all_ips)
        or (v_all_subnets is not null and c.ip_subnet is not null and c.ip_subnet = any(v_all_subnets))
        or exists (
            select 1
              from public.free_credit_user_signals s
             where s.user_id = c.claimed_user_id
               and (
                   (s.ip_address is not null and s.ip_address = any(v_all_ips))
                   or (v_all_subnets is not null and s.ip_subnet is not null and s.ip_subnet = any(v_all_subnets))
               )
        )
     limit 1;

    if v_tmp_claim_id is not null then
        v_reasons := array_append(v_reasons, 'duplicate_ip');
        v_matched_claim_id := coalesce(v_matched_claim_id, v_tmp_claim_id);
    end if;

    -- CEK 3: Kesamaan Password (langsung di free_credit_claims atau riwayat password user yang sudah klaim)
    v_tmp_claim_id := null;
    select c.id
      into v_tmp_claim_id
      from public.free_credit_claims c
     where c.password_hash = any(v_all_pws)
        or exists (
            select 1
              from public.free_credit_user_signals s
             where s.user_id = c.claimed_user_id
               and s.password_hash is not null
               and s.password_hash = any(v_all_pws)
        )
     limit 1;

    if v_tmp_claim_id is not null then
        v_reasons := array_append(v_reasons, 'duplicate_password');
        v_matched_claim_id := coalesce(v_matched_claim_id, v_tmp_claim_id);
    end if;

    -- CEK 4: Kesamaan Browser (browser_install_id maupun hardware/rendering browser_fingerprint)
    v_tmp_claim_id := null;
    select c.id
      into v_tmp_claim_id
      from public.free_credit_claims c
     where c.browser_fingerprint = any(v_all_bfps)
        or c.browser_install_id = any(v_all_bids)
        or exists (
            select 1
              from public.free_credit_user_signals s
             where s.user_id = c.claimed_user_id
               and (
                   (s.browser_fingerprint is not null and s.browser_fingerprint = any(v_all_bfps))
                   or (s.browser_install_id is not null and s.browser_install_id = any(v_all_bids))
               )
        )
     limit 1;

    if v_tmp_claim_id is not null then
        v_reasons := array_append(v_reasons, 'duplicate_browser');
        v_matched_claim_id := coalesce(v_matched_claim_id, v_tmp_claim_id);
    end if;

    -- Bila ada kesamaan Email / IP / Password / Browser -> TOLAK & CATAT di Supabase
    if coalesce(array_length(v_reasons, 1), 0) > 0 then
        v_primary_reason := v_reasons[1];

        insert into public.free_credit_claim_attempts (
            user_id, attempted_user_id, email_exact, email_canonical,
            ip_address, ip_subnet, password_hash,
            browser_fingerprint, browser_install_id,
            user_agent, browser_summary, country, city,
            status, rejection_reason, matched_reasons, matched_claim_id
        ) values (
            p_user_id, p_user_id, v_email_exact, v_email_canonical,
            v_ip, v_subnet, v_pw_hash,
            v_bfp, v_bid,
            v_ua, v_bsum, v_country, v_city,
            'rejected', v_primary_reason, v_reasons, v_matched_claim_id
        );

        return jsonb_build_object(
            'ok', false,
            'code', v_primary_reason,
            'matched_reasons', v_reasons
        );
    end if;

    -- SEMUA UNIK -> TAMBAHKAN 5.000 KREDIT SECARA ATOMIK & CATAT DI SEMUA TABEL AUDIT
    v_new_balance := coalesce(v_profile.credits, 0) + v_reward;

    update public.profiles
       set credits = v_new_balance,
           updated_at = now()
     where id = p_user_id;

    insert into public.free_credit_claims (
        user_id,
        claimed_user_id,
        email_exact,
        email_canonical,
        ip_address,
        ip_subnet,
        password_hash,
        browser_fingerprint,
        browser_install_id,
        user_agent,
        browser_summary,
        country,
        city,
        credit_amount,
        balance_before,
        balance_after
    ) values (
        p_user_id,
        p_user_id,
        v_email_exact,
        v_email_canonical,
        v_ip,
        v_subnet,
        v_pw_hash,
        v_bfp,
        v_bid,
        v_ua,
        v_bsum,
        v_country,
        v_city,
        v_reward,
        coalesce(v_profile.credits, 0),
        v_new_balance
    )
    returning id into v_claim_id;

    insert into public.free_credit_claim_attempts (
        user_id, attempted_user_id, email_exact, email_canonical,
        ip_address, ip_subnet, password_hash,
        browser_fingerprint, browser_install_id,
        user_agent, browser_summary, country, city,
        status, rejection_reason, matched_reasons, claim_id
    ) values (
        p_user_id, p_user_id, v_email_exact, v_email_canonical,
        v_ip, v_subnet, v_pw_hash,
        v_bfp, v_bid,
        v_ua, v_bsum, v_country, v_city,
        'granted', null, array[]::text[], v_claim_id
    );

    insert into public.credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        reference_id,
        description,
        created_by
    ) values (
        p_user_id,
        'free_claim',
        v_reward,
        coalesce(v_profile.credits, 0),
        v_new_balance,
        v_claim_id,
        'Claim Free Credit 5.000 Gratis',
        p_user_id
    );

    return jsonb_build_object(
        'ok', true,
        'claim_id', v_claim_id,
        'credit_amount', v_reward,
        'balance_before', coalesce(v_profile.credits, 0),
        'balance_after', v_new_balance,
        'claimed_at', now()
    );
end;
$$;

revoke all on function public.claim_free_credit_5000(
    uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_free_credit_5000(
    uuid, text, text, text, text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';

commit;
