-- =========================================================
-- GEN-Z.AI — provider gambar Puter di social_publisher_config
-- ---------------------------------------------------------
-- Jalankan file ini di Supabase SQL Editor untuk instalasi yang
-- sudah ada (aman diulang berkali-kali). Instalasi baru tidak
-- perlu file ini: supabase/social-auto-publisher.sql sudah
-- memuat constraint yang sama.
--
-- Tanpa update ini, tombol Simpan Provider menolak pilihan Puter
-- dengan error:
--   new row for relation "social_publisher_config" violates
--   check constraint "social_publisher_config_image_provider_check"
-- =========================================================

alter table public.social_publisher_config
    drop constraint if exists social_publisher_config_image_provider_check;

alter table public.social_publisher_config
    add constraint social_publisher_config_image_provider_check
        check (image_provider in ('gemini', 'cloudflare', 'qwencloud', 'tencent', 'puter'));
