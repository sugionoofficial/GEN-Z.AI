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
