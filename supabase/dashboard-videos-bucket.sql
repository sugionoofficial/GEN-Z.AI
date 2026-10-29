-- =========================================================
-- GEN-Z.AI — BUCKET PUBLIK VIDEO CONTOH DASHBOARD USER
-- ---------------------------------------------------------
-- File: supabase/dashboard-videos-bucket.sql
--
-- Memastikan bucket `dashboard-videos` mendukung unggahan
-- video contoh berdurasi 30 detik+ (hingga 500 MB) beserta
-- format MP4, WebM, MOV (video/quicktime), M4V, dan 3GPP
-- dari perangkat mobile maupun desktop.
-- =========================================================

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'dashboard-videos',
    'dashboard-videos',
    true,
    524288000,
    array[
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-m4v',
        'video/3gpp',
        'image/jpeg',
        'image/png',
        'image/webp',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/x-pn-wav'
    ]
)
on conflict (id) do update
set
    public = true,
    file_size_limit = 524288000,
    allowed_mime_types = array[
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-m4v',
        'video/3gpp',
        'image/jpeg',
        'image/png',
        'image/webp',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/x-pn-wav'
    ];
