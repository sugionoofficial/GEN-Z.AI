-- =====================================================================
-- verify-restore.sql - jalankan di SQL Editor project TARGET
-- Membuktikan restore Fase A utuh, TANPA menuliskan data sensitif ke repo.
--
-- PENTING: berkas ini sengaja hanya berisi SATU query. SQL Editor Supabase
-- hanya menampilkan hasil query TERAKHIR. Versi sebelumnya memakai tiga
-- query terpisah sehingga pengguna hanya melihat hasil bagian ketiga dan
-- mengira 60 tabel tidak terperiksa. Semua pemeriksaan kini digabung.
--
-- Keluaran: satu tabel dengan kolom cek / hasil / target. Target cutover:
--   tabel_gagal = 0  dan  baris_pass = 60.
--
-- Kenapa tidak memakai checksum isi baris: repo ini PUBLIK, dan md5 isi baris
-- dari provider_credentials + free_credit_secret_config (API key provider dan
-- password pepper) setara membocorkan verifier yang bisa di-brute-force
-- offline. Checksum hanya dibuat lewat migrasi/export-fingerprint.sql dan
-- disimpan di supabase/backup/ (di-.gitignore).
-- =====================================================================

with
-- Jumlah baris yang harus dimiliki tiap tabel (sidik jari 2026-11-05).
harapan(tbl, baris) as (values
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
  select c.relname as tbl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
),
-- Tabel yang belum ada tidak boleh membuat query error: dihitung lewat
-- pg_class, bukan dengan menyebut tabel secara langsung.
cek as (
  select
    h.tbl,
    h.baris as harap,
    (a.tbl is not null) as tabel_ada,
    case when a.tbl is null then null else
      (xpath('/row/n/text()', query_to_xml(
         format('select count(*) as n from public.%I', h.tbl),
         false, true, '')))[1]::text::bigint
    end as nyata
  from harapan h
  left join ada a on a.tbl = h.tbl
),
ringkas as (
  select
    count(*) filter (where tabel_ada and nyata = harap)          as jumlah_pass,
    count(*) filter (where not tabel_ada or nyata is distinct from harap) as jumlah_gagal,
    coalesce(string_agg(tbl, ', ') filter (
       where not tabel_ada or nyata is distinct from harap), '-') as daftar_gagal
  from cek
),
-- Satu daftar hasil: setiap baris adalah satu pemeriksaan. Cara ini dipakai
-- karena SQL Editor hanya menampilkan hasil query terakhir.
hasil(no, cek, hasil, target) as (
  select 1, 'tabel_pass',            (select jumlah_pass::text  from ringkas), '60'
  union all select 2, 'tabel_gagal', (select jumlah_gagal::text from ringkas), '0'
  union all select 3, 'tabel_bermasalah',
              (select daftar_gagal from ringkas), '-'
  union all select 4, 'auth.users',
              (select count(*)::text from auth.users), '25'
  union all select 5, 'auth.identities',
              (select count(*)::text from auth.identities), '25'
  union all select 6, 'public.profiles',
              coalesce((select count(*)::text from public.profiles), 'tabel tidak ada'), '25'
  union all select 7, 'public.generation_history',
              coalesce((select count(*)::text from public.generation_history), 'tabel tidak ada'), '502'
  union all select 8, 'public.social_post_runs',
              coalesce((select count(*)::text from public.social_post_runs), 'tabel tidak ada'), '941'
  union all select 9, 'storage.objects',
              (select count(*)::text from storage.objects), '112'
  union all select 10, 'tabel_rls_aktif',
              (select count(*)::text from pg_tables
                where schemaname = 'public' and rowsecurity), '60'
  union all select 11, 'policy',
              (select count(*)::text from pg_policies where schemaname = 'public'), '53'
  union all select 12, 'trigger_public',
              (select count(*)::text from pg_trigger t
                join pg_class c on c.oid = t.tgrelid
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and not t.tgisinternal), '9'
  union all select 13, 'sequence_public',
              (select count(*)::text from pg_sequences where schemaname = 'public'), '5'
  union all select 14, 'fungsi_public',
              (select count(*)::text from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'), '>=60'
  union all select 15, 'owner_ada',
              (select count(*)::text from public.profiles where role = 'OWNER'), '>=1'
)
select
  cek,
  hasil,
  target,
  case
    when target = '-' then '-'
    when target like '>=%'  then case when hasil ~ '^[0-9]+$' and hasil::int >= 1 then 'OK' else 'PERIKSA' end
    when hasil = target     then 'OK'
    else 'PERIKSA'
  end as status
from hasil
order by no;
