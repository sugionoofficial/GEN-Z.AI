-- Kredensial Opus dienkripsi di Worker; hanya service_role boleh mengakses tabel.
create table if not exists public.opus_credentials (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    ciphertext text not null,
    iv text not null,
    tag text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.opus_credentials enable row level security;
revoke all on table public.opus_credentials from public, anon, authenticated;
grant all on table public.opus_credentials to service_role;
notify pgrst, 'reload schema';
