-- =========================================================
-- GEN-Z.AI — OPSI LATAR + FOTO KARAKTER PADA JADWAL AUTOPOST
-- ---------------------------------------------------------
-- File: supabase/social-schedule-quote-character.sql
--
-- Mode "Kata-kata Mutiara + Musik Auto-Play" kini bisa menyertakan
-- foto karakter yang dipilih dengan outfit acak dari koleksi
-- outfit aktif karakter tersebut. Pilihan disimpan per jadwal
-- autopost; `character_id` yang sudah ada dipakai kembali untuk
-- menyimpan karakter yang dipilih (kolomnya memang nullable).
--
-- Latar AI tetap dibuat oleh provider + model gambar pilihan
-- SET Studio Medsos (mis. OPUS), dan visualnya mengikuti makna
-- kalimat mutiara. QWENCLOUD_API_KEY hanya untuk LLM penulis teks.
--
-- Jalankan di Supabase SQL Editor (idempotent).
-- =========================================================

alter table public.social_post_schedules
    add column if not exists quote_use_character boolean not null default false;

comment on column public.social_post_schedules.quote_use_character is
    'Mode Kata-kata Mutiara: true = latar AI memakai foto karakter pada character_id + outfit acak dari koleksi aktif karakter itu; false = latar pemandangan tanpa orang.';

-- Jadwal lama tidak berubah (default false). Tidak ada perubahan pada
-- fungsi claim_due_social_post_schedules: cron mengambil jadwal dengan
-- select eksplisit dan otomatis turun ke daftar kolom lama bila
-- migration ini belum dijalankan.
