-- Migrasi: Auto Generate & Auto Publish Kata-kata Mutiara + Lagu Random Facebook
-- Aman dijalankan ulang (idempotent).

create table if not exists public.social_facebook_songs (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 140),
    artist text not null default '' check (char_length(artist) <= 120),
    facebook_url text not null default '' check (char_length(facebook_url) <= 500),
    mood text not null default '' check (char_length(mood) <= 60),
    audio_object_key text not null default '',
    audio_mime_type text not null default '',
    duration_seconds numeric(5,1) not null default 15,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id)
);

alter table public.social_facebook_songs
    add column if not exists audio_object_key text not null default '';

alter table public.social_facebook_songs
    add column if not exists audio_mime_type text not null default '';

alter table public.social_facebook_songs
    add column if not exists duration_seconds numeric(5,1) not null default 15;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'social-story-audio',
    'social-story-audio',
    false,
    16777216,
    array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/vnd.dlna.adts', 'video/mp4']
)
on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists social_facebook_songs_owner_active_idx
    on public.social_facebook_songs (owner_id, is_active, created_at desc);

alter table public.social_facebook_songs enable row level security;
revoke all on table public.social_facebook_songs from public, anon, authenticated;
grant select, insert, update, delete on table public.social_facebook_songs to service_role;

-- Jadwal autopost kini mendukung mode 'character' (foto karakter AI) dan 'quote' (kata-kata mutiara estetik).
alter table public.social_post_schedules
    alter column character_id drop not null;

alter table public.social_post_schedules
    add column if not exists post_mode text not null default 'character';

alter table public.social_post_schedules
    add column if not exists quote_theme text not null default '';

alter table public.social_post_schedules
    add column if not exists quote_visual_style text not null default '';

alter table public.social_post_schedules
    add column if not exists use_random_song boolean not null default false;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'social_post_schedules_post_mode_chk'
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_post_mode_chk
            check (post_mode in ('character', 'quote'));
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_schedules_mode_character_chk'
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_mode_character_chk
            check (post_mode = 'quote' or character_id is not null);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_schedules_quote_theme_chk'
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_quote_theme_chk
            check (char_length(quote_theme) <= 120);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_schedules_quote_visual_style_chk'
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_quote_visual_style_chk
            check (char_length(quote_visual_style) <= 240);
    end if;
end $$;

-- Riwayat run mencatat kutipan & lagu acak yang dipakai pada setiap postingan.
alter table public.social_post_runs
    add column if not exists post_mode text not null default 'character';

alter table public.social_post_runs
    add column if not exists quote_text text not null default '';

alter table public.social_post_runs
    add column if not exists quote_theme text not null default '';

alter table public.social_post_runs
    add column if not exists song_id uuid references public.social_facebook_songs(id) on delete set null;

alter table public.social_post_runs
    add column if not exists song_title text not null default '';

alter table public.social_post_runs
    add column if not exists song_artist text not null default '';

alter table public.social_post_runs
    add column if not exists song_facebook_url text not null default '';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_post_mode_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_post_mode_chk
            check (post_mode in ('character', 'quote'));
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_quote_text_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_quote_text_chk
            check (char_length(quote_text) <= 500);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_quote_theme_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_quote_theme_chk
            check (char_length(quote_theme) <= 120);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_song_title_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_song_title_chk
            check (char_length(song_title) <= 140);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_song_artist_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_song_artist_chk
            check (char_length(song_artist) <= 120);
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'social_post_runs_song_facebook_url_chk'
    ) then
        alter table public.social_post_runs
            add constraint social_post_runs_song_facebook_url_chk
            check (char_length(song_facebook_url) <= 500);
    end if;
end $$;

notify pgrst, 'reload schema';
