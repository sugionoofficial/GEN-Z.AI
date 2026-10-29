-- ============================================================================
-- GEN-Z.AI — PILIHAN LAGU AUTOPOST (MANUAL / SATU LAGU TETAP / ACAK)
-- ----------------------------------------------------------------------------
-- Status: dijalankan di project ycovbqmezhrvzobxqnyp (GEN-Z.AI) 2026-10-29.
-- Idempotent: aman dijalankan berulang.
--
-- LATAR BELAKANG
-- Facebook tidak menyediakan endpoint Graph API untuk menampilkan katalog
-- musik resmi mereka atau memasang track dari pustaka Facebook ke post Page
-- lewat API. Karena itu "lagu Facebook" di app ini berarti koleksi lagu milik
-- akun sendiri (tabel public.social_facebook_songs) yang diunggah lewat panel.
--
-- Kolom `use_random_song` (boolean) tidak cukup untuk tiga kebutuhan:
--   1. tanpa lagu,
--   2. satu lagu tetap pilihan pengguna,
--   3. acak tanpa mengulang lagu terakhir.
-- Maka ditambahkan `song_mode` + `song_id`; `use_random_song` tetap diisi
-- (song_mode = 'random') supaya kode/deployment lama tidak rusak.
-- ============================================================================

alter table public.social_post_schedules
    add column if not exists song_mode text not null default 'off';

alter table public.social_post_schedules
    add column if not exists song_id uuid
    references public.social_facebook_songs(id) on delete set null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'social_post_schedules_song_mode_chk'
           and conrelid = 'public.social_post_schedules'::regclass
    ) then
        alter table public.social_post_schedules
            add constraint social_post_schedules_song_mode_chk
            check (song_mode in ('off', 'fixed', 'random'));
    end if;
end $$;

-- Backfill baris lama: use_random_song = true berarti mode acak.
update public.social_post_schedules
   set song_mode = 'random'
 where use_random_song = true
   and song_mode = 'off';

-- Indeks kecil untuk pencarian lagu tetap.
create index if not exists social_post_schedules_song_idx
    on public.social_post_schedules (song_id)
    where song_id is not null;

comment on column public.social_post_schedules.song_mode is
    'off = tanpa lagu, fixed = pakai song_id, random = acak tanpa mengulang lagu terakhir.';
comment on column public.social_post_schedules.song_id is
    'Lagu tetap (mode fixed). Diabaikan bila lagu nonaktif/dihapus, autopost jatuh ke acak.';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verifikasi
--   select song_mode, song_id, count(*)
--     from public.social_post_schedules group by 1, 2;
-- ---------------------------------------------------------------------------
