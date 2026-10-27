-- =========================================================
-- GEN-Z.AI — constraint daftar provider di social_publisher_config
-- ---------------------------------------------------------
-- Jalankan file ini di Supabase SQL Editor (aman diulang berkali-kali).
--
-- Gejala bila file ini belum dijalankan: tombol Simpan Provider
-- (Gemini / Cloudflare / QwenCloud / Tencent / Puter / Opus) bisa gagal dengan
--   {"code":"23514","error":"new row for relation \"social_publisher_config\"
--    violates check constraint \"..._image_provider_check\""}
-- karena check constraint di database masih memuat daftar provider lama
-- (contoh nyata: instalasi lama bahkan belum mengenal 'tencent').
--
-- File ini memperbarui constraint daftar provider GAMBAR dan provider TEKS
-- sekaligus, untuk SEMUA pilihan provider — bukan hanya 'puter' / 'opus'.
--
-- Instalasi baru tidak perlu file ini: supabase/social-auto-publisher.sql
-- sudah memuat constraint yang sama.
-- =========================================================

alter table public.social_publisher_config
    add column if not exists text_provider text not null default 'auto';

alter table public.social_publisher_config
    drop constraint if exists social_publisher_config_image_provider_check;

alter table public.social_publisher_config
    add constraint social_publisher_config_image_provider_check
        check (image_provider in ('gemini', 'cloudflare', 'qwencloud', 'tencent', 'puter', 'opus'));

alter table public.social_publisher_config
    drop constraint if exists social_publisher_config_text_provider_check;

alter table public.social_publisher_config
    add constraint social_publisher_config_text_provider_check
        check (text_provider in ('auto', 'tencent', 'cloudflare', 'gemini', 'qwencloud'));
