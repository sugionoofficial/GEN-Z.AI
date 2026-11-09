-- TempMail "Hubungkan Gmail" (Mode C).
-- Refresh token Google TIDAK PERNAH dikirim ke browser. Worker menyimpan
-- ciphertext AES-GCM + IV di tabel ini; dekripsi hanya terjadi di Worker
-- dengan PROVIDER_CREDENTIAL_ENCRYPTION_KEY (Cloudflare secret).

create table if not exists public.tempmail_gmail_connections (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    refresh_token_ciphertext text not null,
    refresh_token_iv text not null,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

alter table public.tempmail_gmail_connections enable row level security;
revoke all on public.tempmail_gmail_connections from public, anon, authenticated;
grant all on public.tempmail_gmail_connections to service_role;

comment on table public.tempmail_gmail_connections is
    'OAuth Gmail credentials for TempMail; service_role only, ciphertext AES-256-GCM.';

-- PostgREST menyimpan schema cache; NOTIFY agar /rest/v1/... langsung dikenal.
select pg_notify('pgrst', 'reload schema');
