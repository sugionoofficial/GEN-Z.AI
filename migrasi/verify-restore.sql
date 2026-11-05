-- =====================================================================
-- verify-restore.sql — jalankan di SQL Editor project TARGET
-- Membuktikan restore Fase A utuh, TANPA menuliskan data sensitif ke repo.
--
-- Kenapa tidak memakai checksum isi baris di berkas ini: repo ini PUBLIK,
-- dan md5 isi baris dari `provider_credentials` + `free_credit_secret_config`
-- (berisi API key provider dan password pepper) akan setara membocorkan
-- verifier yang bisa di-brute-force offline. Karena itu:
--   - berkas ini (aman di-commit)  : struktur + jumlah baris + cakupan RLS
--   - checksum isi baris (rahasia) : dibuat sendiri lewat migrasi/export-fingerprint.sql
--     dan disimpan di supabase/backup/ (sudah di .gitignore)
--
-- Hasil yang diharapkan: semua 'PASS' dan `tabel_pass` = 60.
-- =====================================================================

-- ---------------------------------------------------------------- 1/3
-- Jumlah baris per tabel dibandingkan dengan sidik jari 2026-11-05.
with harapan(tbl, baris) as (values
    ('account_deletion_requests',1),        ('credit_change_audit',395),
    ('credit_packages',5),                  ('credit_transactions',12),
    ('dashboard_videos',9),                 ('facebook_oauth_states',0),
    ('feature_credit_settings',14),         ('feature_credit_transactions',261),
    ('free_credit_claim_attempts',25),      ('free_credit_claims',7),
    ('free_credit_secret_config',1),        ('free_credit_settings',1),
    ('free_credit_user_signals',60),        ('generation_history',502),
    ('hub_admin_settings',1),               ('kie_constraints',0),
    ('kie_dependencies',0),                 ('kie_models',0),
    ('kie_parameters',0),                   ('kie_pricing',0),
    ('kie_workflow_variants',0),            ('kie_workflows',0),
    ('model_quota',17),                     ('models',45),
    ('monitoring_events',500),              ('monitoring_findings',9),
    ('monitoring_health_checks',1400),      ('monitoring_settings',1),
    ('motion_ui_jobs',2),                   ('opus_oauth_tokens',8),
    ('profiles',25),                        ('provider_credentials',8),
    ('providers',9),                        ('site_announcements',1),
    ('social_characters',2),                ('social_data_deletion_requests',0),
    ('social_facebook_identities',2),       ('social_facebook_songs',1),
    ('social_outfits',47),                  ('social_page_connections',4),
    ('social_post_runs',941),               ('social_post_schedules',2),
    ('social_publisher_config',1),          ('social_publisher_model_quotas',8),
    ('social_publisher_user_settings',2),   ('social_video_accounts',4),
    ('social_video_oauth_states',0),        ('social_video_posts',4),
    ('staged_generation_jobs',30),          ('studio_medsos_access',2),
    ('studio_medsos_pricing',1),            ('support_agent_presence',1),
    ('support_conversations',5),            ('support_messages',34),
    ('system_settings',5),                  ('tempmail_user_aliases',0),
    ('topup_payment_methods',11),           ('topup_payments',2),
    ('topup_requests',7),                   ('user_presence',14)
),
ada as (
  select c.relname as tbl from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
),
nilai as (
  select h.tbl, h.baris as harap, (a.tbl is not null) as tabel_ada,
    case when a.tbl is null then null else
      (xpath('/row/n/text()', query_to_xml(
         format('select count(*) as n from public.%I', h.tbl),
         false, true, '')))[1]::text::bigint
    end as nyata
  from harapan h left join ada a on a.tbl = h.tbl
),
hasil as (
  select *,
    case when not tabel_ada                then 'GAGAL (tabel tidak ada)'
         when nyata <> harap               then 'GAGAL (jumlah baris)'
         else 'PASS' end as status
  from nilai
)
select tbl, harap, nyata, status
from hasil
order by (status <> 'PASS') desc, tbl;

-- ---------------------------------------------------------------- 2/3
-- Ringkasan. Target: tabel_pass 60, tabel_gagal 0, semua cek lain 'OK'.
with harapan(tbl, baris) as (values
    ('account_deletion_requests',1),('credit_change_audit',395),('credit_packages',5),
    ('credit_transactions',12),('dashboard_videos',9),('facebook_oauth_states',0),
    ('feature_credit_settings',14),('feature_credit_transactions',261),
    ('free_credit_claim_attempts',25),('free_credit_claims',7),
    ('free_credit_secret_config',1),('free_credit_settings',1),
    ('free_credit_user_signals',60),('generation_history',502),
    ('hub_admin_settings',1),('kie_constraints',0),('kie_dependencies',0),
    ('kie_models',0),('kie_parameters',0),('kie_pricing',0),
    ('kie_workflow_variants',0),('kie_workflows',0),('model_quota',17),
    ('models',45),('monitoring_events',500),('monitoring_findings',9),
    ('monitoring_health_checks',1400),('monitoring_settings',1),
    ('motion_ui_jobs',2),('opus_oauth_tokens',8),('profiles',25),
    ('provider_credentials',8),('providers',9),('site_announcements',1),
    ('social_characters',2),('social_data_deletion_requests',0),
    ('social_facebook_identities',2),('social_facebook_songs',1),
    ('social_outfits',47),('social_page_connections',4),('social_post_runs',941),
    ('social_post_schedules',2),('social_publisher_config',1),
    ('social_publisher_model_quotas',8),('social_publisher_user_settings',2),
    ('social_video_accounts',4),('social_video_oauth_states',0),
    ('social_video_posts',4),('staged_generation_jobs',30),
    ('studio_medsos_access',2),('studio_medsos_pricing',1),
    ('support_agent_presence',1),('support_conversations',5),('support_messages',34),
    ('system_settings',5),('tempmail_user_aliases',0),('topup_payment_methods',11),
    ('topup_payments',2),('topup_requests',7),('user_presence',14)
),
ada as (
  select c.relname as tbl from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
),
cek as (
  select h.tbl, h.baris as harap, (a.tbl is not null) as tabel_ada,
    case when a.tbl is null then null else
      (xpath('/row/n/text()', query_to_xml(
         format('select count(*) as n from public.%I', h.tbl),
         false, true, '')))[1]::text::bigint
    end as nyata
  from harapan h left join ada a on a.tbl = h.tbl
),
ringkas as (
  select
    count(*) filter (where tabel_ada and nyata = harap) as pass,
    string_agg(tbl, ', ') filter (where not tabel_ada or nyata is distinct from harap) as gagal
  from cek
)
select 'tabel_pass'  as cek, (select pass from ringkas)::text as hasil, '60' as target
union all select 'tabel_gagal', coalesce((select gagal from ringkas), '0'), '0'
union all select 'auth.users',
  (select count(*)::text from auth.users), '25'
union all select 'auth.identities',
  (select count(*)::text from auth.identities), '25'
union all select 'storage.objects',
  (select count(*)::text from storage.objects), '112'
union all select 'tabel_rls_aktif',
  (select count(*)::text from pg_tables where schemaname = 'public' and rowsecurity), '60'
union all select 'policy',
  (select count(*)::text from pg_policies where schemaname = 'public'), '53'
union all select 'trigger_public',
  (select count(*)::text from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal), '9'
union all select 'sequence_public',
  (select count(*)::text from pg_sequences where schemaname = 'public'), '5'
-- Nilai `profiles.role` di data nyata adalah 'OWNER' dan 'USER' (huruf besar),
-- bukan 'admin'. Akun OWNER wajib selamat — tanpa itu tidak ada yang bisa
-- masuk ke panel admin setelah cutover.
union all select 'owner_ada',
  (select count(*)::text from public.profiles where role = 'OWNER'), '>=1';

-- ---------------------------------------------------------------- 3/3
-- Fungsi wajib: kalau RLS/trigger ikut ter-restore, cek ini harus menemukan
-- fungsi inti aplikasi. Nama fungsi tidak di-hard-code satu per satu —
-- cukup pastikan jumlahnya masuk akal (>=60) dan tidak nol.
select count(*) as jumlah_fungsi_public,
       case when count(*) >= 60 then 'OK'
            when count(*) = 0   then 'GAGAL (fungsi hilang)'
            else 'PERIKSA (kurang dari 60)' end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
