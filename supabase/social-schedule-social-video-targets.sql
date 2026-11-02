-- =========================================================
-- GEN-Z.AI — TARGET CROSSPOST YOUTUBE/TIKTOK PADA JADWAL FB
-- ---------------------------------------------------------
-- File: supabase/social-schedule-social-video-targets.sql
--
-- Jadwal autopost Facebook mode "Kata-kata Mutiara + Lagu"
-- kini bisa mengarahkan hasil render video-nya ke akun
-- YouTube/TikTok yang terhubung. Daftar akun disimpan sebagai
-- array uuid milik tabel social_video_accounts; cron Facebook
-- mengunggah mp4 yang sama ke bucket privat lalu membuat
-- baris social_video_posts berstatus scheduled per akun.
--
-- Jalankan di Supabase SQL Editor (idempotent).
-- =========================================================

alter table public.social_post_schedules
    add column if not exists social_video_account_ids uuid[] not null default '{}';

comment on column public.social_post_schedules.social_video_account_ids is
    'Akun YouTube/TikTok (social_video_accounts.id) tujuan crosspost video Kata-kata Mutiara; kosong = Facebook saja.';
