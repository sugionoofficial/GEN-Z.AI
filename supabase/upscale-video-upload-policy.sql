-- =========================================================
-- GEN-Z.AI — POLICY UPLOAD VIDEO UPSCALE
-- ---------------------------------------------------------
-- File: supabase/upscale-video-upload-policy.sql
--
-- Jalankan di Supabase SQL Editor agar akun yang login bisa
-- mengunggah video sumber HANYA ke folder miliknya sendiri:
--
--   dashboard-videos/upscale-videos/inputs/<user-id>/...
--
-- CATATAN RETENSI (lihat STORAGE-RETENTION.md):
--   * Video sumber & hasil upscale disimpan maksimal 24 JAM.
--   * Cron Worker (tiap 5 menit) menghapus objek di
--     `upscale-videos/`, `upscale-photos/`, dan
--     `dashboard-upscales/outputs/` yang umurnya > 24 jam.
--   * Karena itu file di folder ini TIDAK untuk disimpan
--     permanen — user harus mengunduh hasilnya sebelum
--     kedaluwarsa.
--   * Policy di bawah hanya mengatur INSERT; penghapusan
--     dilakukan server memakai service-role key, sehingga
--     tidak butuh policy DELETE untuk user.
-- =========================================================

DROP POLICY IF EXISTS "Users upload own upscale video inputs"
    ON storage.objects;

CREATE POLICY "Users upload own upscale video inputs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'dashboard-videos'
        AND (storage.foldername(name))[1] = 'upscale-videos'
        AND (storage.foldername(name))[2] = 'inputs'
        AND (storage.foldername(name))[3] = auth.uid()::text
        AND name ~ (
            '^upscale-videos/inputs/'
            || auth.uid()::text
            || '/[0-9]+-[a-z0-9]{8}\.(mp4|webm|mov|m4v)$'
        )
    );
