-- dashboard_videos: prompt per-video untuk admin/owner (user dashboard edit mode)
-- UI: user/dashboard.html — blok "Prompt video" pada modal Tambah/Edit Video.
-- NULL berarti memakai prompt standar GEN-Z.AI (fallback di sisi UI).

alter table "public"."dashboard_videos"
    add column if not exists "prompt" text;

comment on column "public"."dashboard_videos"."prompt" is
    'Prompt per-video yang disalin user; NULL berarti pakai prompt standar GEN-Z.AI';
