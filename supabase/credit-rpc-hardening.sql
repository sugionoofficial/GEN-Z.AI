/* =========================================================
   GEN-Z.AI — CREDIT RPC HARDENING
   ---------------------------------------------------------
   MASALAH
   Fungsi kredit berjalan sebagai SECURITY DEFINER (bisa
   mengubah public.profiles.credits tanpa RLS). PostgREST
   mengekspos semua fungsi di schema public yang punya
   privilege EXECUTE. Di Postgres, fungsi baru otomatis
   mendapat EXECUTE untuk PUBLIC (dan Supabase juga memberi
   default privilege ke anon/authenticated), sehingga fungsi
   seperti public.refund_generate_credits() bisa dipanggil
   langsung oleh siapa pun yang memegang anon key:

     POST /rest/v1/rpc/refund_generate_credits
     { "p_user_id": "<uuid siapa pun>", "p_amount": 999999 }

   Itu membuat kredit bertambah tanpa pembayaran
   (billing bypass), dan bisa juga menargetkan user lain.

   YANG DILAKUKAN MIGRATION INI
   1. Mencabut EXECUTE dari PUBLIC, anon, dan authenticated
      untuk semua fungsi kredit (refund/deduct/charge/settle)
      apa pun signature-nya (dicari lewat pg_proc, jadi tidak
      perlu tahu daftar parameter pastinya).
   2. Memberi EXECUTE hanya ke service_role, karena semua
      pemanggil sah memang server-side:
        - api/generate.js
        - api/feature-credits.js
        - api/admin-cancel-generation.js
        - .github/workflows/upscale.yml, upscale-photo.yml
        - fungsi SECURITY DEFINER lain (charge/settle) yang
          memanggil refund di dalam database
   3. Tidak mengubah isi/logika fungsi apa pun, hanya hak akses.

   CARA PAKAI
   Jalankan seluruh file ini di Supabase → SQL Editor
   (sekali saja, idempotent, boleh diulang).
========================================================= */

begin;

do $hardening$
declare
    v_signature text;
begin
    for v_signature in
        select p.oid::regprocedure::text
          from pg_proc p
          join pg_namespace n
            on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in (
               'refund_generate_credits',
               'deduct_generate_credits',
               'refund_failed_generation_credits',
               'charge_feature_credits',
               'settle_feature_credits'
           )
    loop
        execute format(
            'revoke all on function %s from public',
            v_signature
        );

        execute format(
            'revoke all on function %s from anon, authenticated',
            v_signature
        );

        execute format(
            'grant execute on function %s to service_role',
            v_signature
        );

        raise notice 'hardened: %', v_signature;
    end loop;
end;
$hardening$;

commit;


/* =========================================================
   VERIFIKASI SETELAH MIGRATION
   ---------------------------------------------------------
   1. ACL fungsi kredit.
      Kolom proacl harus menampilkan service_role saja
      (tidak ada "=X/" yang berarti PUBLIC, tidak ada anon
      atau authenticated).

      select p.proname,
             p.oid::regprocedure as signature,
             p.prosecdef        as security_definer,
             p.proacl           as acl
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
             'refund_generate_credits',
             'deduct_generate_credits',
             'refund_failed_generation_credits',
             'charge_feature_credits',
             'settle_feature_credits'
         );

   2. Uji dari client (harus GAGAL 401/403 "permission denied"):
      curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/refund_generate_credits" \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"p_user_id":"<uuid-akun-uji>","p_amount":1}'

   3. RLS + hak kolom tabel profiles (jalankan manual, lihat
      laporan audit untuk detail):
      select policyname, cmd, qual, with_check
        from pg_policies
       where schemaname = 'public' and tablename = 'profiles';

      select grantee, privilege_type, column_name
        from information_schema.column_privileges
       where table_schema = 'public'
         and table_name = 'profiles'
         and grantee in ('anon', 'authenticated');
========================================================= */
