-- ============================================================================
-- GEN-Z.AI — "TANDai / LINK PROFIL" PADA CAPTION (OPSIONAL)
-- ----------------------------------------------------------------------------
-- Status: dijalankan di project ycovbqmezhrvzobxqnyp (GEN-Z.AI) 2026-10-29.
-- Idempotent: aman dijalankan berulang.
--
-- PENTING — batasan Meta:
-- Facebook Graph API TIDAK menyediakan cara men-tag akun orang (mention yang
-- memunculkan notifikasi) pada post Page. `message_tags` bersifat read-only,
-- format `@[id:0:nama]` tidak lagi berfungsi, dan parameter `tags` pada foto
-- membutuhkan `publish_actions` yang sudah dihapus sejak 2018.
--
-- Karena itu yang didukung aplikasi ini adalah MENAUTKAN PROFIL di caption:
--   👤 Nama — https://www.facebook.com/username
-- Tautan bisa diklik, tetapi TIDAK mengirim notifikasi ke pemilik akun.
-- ============================================================================

alter table public.social_post_schedules
    add column if not exists tag_name text not null default '';

alter table public.social_post_schedules
    add column if not exists tag_url text not null default '';

do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'social_post_schedules_tag_name_chk'
           and conrelid = 'public.social_post_schedules'::regclass
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_tag_name_chk
            check (char_length(tag_name) <= 80);
    end if;
    if not exists (
        select 1 from pg_constraint
         where conname = 'social_post_schedules_tag_url_chk'
           and conrelid = 'public.social_post_schedules'::regclass
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_tag_url_chk
            check (char_length(tag_url) <= 300);
    end if;
end $$;

comment on column public.social_post_schedules.tag_name is
    'Nama tampilan untuk tautan profil di caption (opsional, bukan tag resmi Meta).';
comment on column public.social_post_schedules.tag_url is
    'URL profil Facebook yang ditautkan di caption (opsional). Hanya host Facebook yang diterima.';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verifikasi
--   select tag_name, tag_url, count(*) from public.social_post_schedules group by 1,2;
-- ---------------------------------------------------------------------------
