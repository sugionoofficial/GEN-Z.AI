/* =========================================================
   GEN-Z.AI — CREDIT RPC HARDENING
   ---------------------------------------------------------
   Status: SUDAH DIJALANKAN di project ycovbqmezhrvzobxqnyp
           (GEN-Z.AI) pada 2026-10-29. File ini adalah salinan
           idempotent-nya supaya bisa diulang / dipakai di
           project lain.

   MASALAH
   Fungsi kredit berjalan sebagai SECURITY DEFINER (bisa
   mengubah public.profiles.credits tanpa RLS). PostgREST
   mengekspos semua fungsi di schema public yang punya
   privilege EXECUTE. Di Postgres, fungsi baru otomatis
   mendapat EXECUTE untuk PUBLIC (dan Supabase menambah
   default privilege ke anon/authenticated).

   Kondisi ACL sebelum migration (hasil audit):

     refund_generate_credits(uuid,numeric)          =X/ postgres, anon, authenticated
     deduct_generate_credits(uuid,numeric)          =X/ postgres, anon, authenticated
     refund_failed_generation_credits(uuid,text)    =X/ postgres, anon, authenticated
     deduct_credit(uuid,integer,text,uuid)          =X/ postgres, anon, authenticated
     refund_credit(uuid,integer,text,uuid)          =X/ postgres, anon, authenticated
     admin_cancel_generation(uuid,text)             =X/ postgres, anon, authenticated
     admin_set_model_quota(uuid,integer,date,bool)  =X/ postgres, anon, authenticated

   Dampak nyata:
     - refund_credit() dan refund_generate_credits() TANPA cek
       otorisasi -> siapa pun bisa MENCETAK kredit untuk
       akun mana pun (billing bypass).
     - deduct_credit() dan deduct_generate_credits() TANPA cek
       otorisasi -> siapa pun bisa MENGURAS saldo akun mana
       pun sampai 0 (p_user_id bebas).
     - admin_cancel_generation() / admin_set_model_quota()
       tanpa cek admin -> bisa membatalkan job & mengubah kuota.

   YANG DILAKUKAN MIGRATION INI
   1. fungsi kredit/mutasi -> EXECUTE hanya untuk service_role
   2. fungsi ber-guard admin (add_credit, admin_remove_credit,
      approve_topup, approve_topup_and_add_credits, admin_*provider)
      -> tetap untuk authenticated, cabut anon + PUBLIC
   3. fungsi statistik (sum/count/get_active_user_ids) -> guard
      public.is_admin_or_owner() di dalam body + cabut anon
   4. trigger guard_profile_credits pada public.profiles:
      menolak perubahan kolom credits dari role anon/authenticated
      (defense in depth kalau suatu saat policy RLS ditambah)
========================================================= */

begin;

/* ---------------------------------------------------------
   1. KREDIT & MUTASI SENSITIF — service_role saja
--------------------------------------------------------- */

do $m$
declare
    v_sig text;
    v_fns text[] := array[
        'refund_generate_credits(uuid,numeric)',
        'deduct_generate_credits(uuid,numeric)',
        'refund_failed_generation_credits(uuid,text)',
        'deduct_credit(uuid,integer,text,uuid)',
        'refund_credit(uuid,integer,text,uuid)',
        'admin_cancel_generation(uuid,text)',
        'admin_set_model_quota(uuid,integer,date,boolean)',
        'qwencloud_quota_reconcile_all()',
        'qwencloud_quota_reconcile(uuid)',
        'qwencloud_quota_recheck(uuid)',
        'charge_feature_credits(uuid,text,uuid,text,text,text)',
        'settle_feature_credits(uuid,uuid,text,text,text)'
    ];
begin
    foreach v_sig in array v_fns loop
        begin
            execute format('revoke all on function public.%s from public', v_sig);
            execute format('revoke all on function public.%s from anon, authenticated', v_sig);
            execute format('grant execute on function public.%s to service_role', v_sig);
        exception when undefined_function then
            raise notice 'skip (tidak ada): %', v_sig;
        end;
    end loop;
end
$m$;

/* ---------------------------------------------------------
   2. FUNGSI BER-GUARD ADMIN — cabut anon & PUBLIC
      (authenticated tetap, karena halaman admin memakainya
       dengan JWT admin dan fungsi ini sudah memeriksa role)
--------------------------------------------------------- */

do $m$
declare
    v_sig text;
    v_fns text[] := array[
        'add_credit(uuid,integer,text,text)',
        'admin_remove_credit(uuid,integer,text)',
        'approve_topup(uuid)',
        'approve_topup_and_add_credits(uuid)',
        'admin_create_provider(text,text,text,text,boolean)',
        'admin_update_provider(uuid,text,text,text,text,boolean)',
        'admin_delete_provider(uuid)'
    ];
begin
    foreach v_sig in array v_fns loop
        begin
            execute format('revoke all on function public.%s from public', v_sig);
            execute format('revoke all on function public.%s from anon', v_sig);
        exception when undefined_function then
            raise notice 'skip (tidak ada): %', v_sig;
        end;
    end loop;
end
$m$;

/* ---------------------------------------------------------
   3. STATISTIK — guard admin di dalam body
      (dipakai admin/dashboard/index.html lewat JWT admin)
--------------------------------------------------------- */

create or replace function public.sum_profile_credits()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not public.is_admin_or_owner() then
        raise exception 'ADMIN_ONLY' using errcode = '42501';
    end if;
    return (select coalesce(sum(credits), 0)::bigint from public.profiles);
end;
$$;

create or replace function public.count_profiles()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not public.is_admin_or_owner() then
        raise exception 'ADMIN_ONLY' using errcode = '42501';
    end if;
    return (select count(*)::bigint from public.profiles);
end;
$$;

create or replace function public.count_active_profiles()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not public.is_admin_or_owner() then
        raise exception 'ADMIN_ONLY' using errcode = '42501';
    end if;
    return (select count(*)::bigint from public.profiles where status = 'active');
end;
$$;

create or replace function public.count_generation_history()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not public.is_admin_or_owner() then
        raise exception 'ADMIN_ONLY' using errcode = '42501';
    end if;
    return (select count(*)::bigint from public.generation_history);
end;
$$;

create or replace function public.get_active_user_ids()
returns setof uuid
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not public.is_admin_or_owner() then
        raise exception 'ADMIN_ONLY' using errcode = '42501';
    end if;
    return query
        select distinct gh.user_id
          from public.generation_history gh
         where gh.status in ('processing', 'pending')
           and gh.user_id is not null;
end;
$$;

revoke all on function public.sum_profile_credits() from public, anon;
revoke all on function public.count_profiles() from public, anon;
revoke all on function public.count_active_profiles() from public, anon;
revoke all on function public.count_generation_history() from public, anon;
revoke all on function public.get_active_user_ids() from public, anon;

/* ---------------------------------------------------------
   4. TRIGGER PELINDUNG KOLOM CREDITS
--------------------------------------------------------- */

create or replace function public.guard_profile_credits()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
    if new.credits is distinct from old.credits
       and current_user in ('anon', 'authenticated') then
        raise exception 'CREDITS_READ_ONLY'
            using errcode = '42501',
                  hint = 'Kredit hanya bisa diubah lewat endpoint/RPC server (service_role).';
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

notify pgrst, 'reload schema';

commit;


/* =========================================================
   VERIFIKASI (jalankan setelah migration)
   ---------------------------------------------------------

   1. Tidak boleh ada fungsi kredit yang bisa dipanggil anon
      atau authenticated:

      select p.oid::regprocedure::text as signature,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can,
             p.proacl::text as acl
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
             'refund_generate_credits','deduct_generate_credits',
             'refund_failed_generation_credits','deduct_credit','refund_credit',
             'admin_cancel_generation','admin_set_model_quota',
             'charge_feature_credits','settle_feature_credits'
         )
       order by 2 desc, 3 desc, 1;
      -- Harus: anon_can = false, auth_can = false untuk semua baris.

   2. Uji sebagai anon (harus "permission denied"):

      begin;
      set local role anon;
      select public.refund_generate_credits(
          '00000000-0000-0000-0000-000000000000'::uuid, 1);
      rollback;

   3. Uji sebagai authenticated pada kolom credits (harus gagal):

      begin;
      set local role authenticated;
      update public.profiles set credits = 0
       where id = (select id from public.profiles limit 1);
      rollback;

   4. Server (service_role) harus tetap bisa:

      begin;
      set local role service_role;
      select public.refund_generate_credits(
          '00000000-0000-0000-0000-000000000000'::uuid, 1);
      rollback;
      -- Harus sampai ke badan fungsi: "USER_PROFILE_NOT_FOUND"
      -- (bukan "permission denied").
========================================================= */
