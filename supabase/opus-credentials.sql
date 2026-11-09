-- Kredensial Opus dienkripsi sebelum disimpan; hanya service_role boleh mengakses tabel.
create table if not exists public.opus_credentials (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    ciphertext text not null,
    iv text not null,
    tag text not null,
    credit_status text not null default 'unknown',
    credit_status_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.opus_credentials
    add column if not exists credit_status text not null default 'unknown';
alter table public.opus_credentials
    add column if not exists credit_status_updated_at timestamptz;
alter table public.opus_credentials enable row level security;
revoke all on table public.opus_credentials from public, anon, authenticated;
grant all on table public.opus_credentials to service_role;
notify pgrst, 'reload schema';

-- Tetapkan nomor slot yang stabil untuk akun yang sudah tersimpan.
alter table public.opus_credentials add column if not exists slot bigint;
with numbered as (
    select id, row_number() over (order by created_at, id) +
        coalesce((select max(slot) from public.opus_credentials), 0) as new_slot
    from public.opus_credentials where slot is null
)
update public.opus_credentials c set slot = numbered.new_slot
from numbered where c.id = numbered.id;
alter table public.opus_credentials alter column slot set not null;
create unique index if not exists opus_credentials_slot_unique on public.opus_credentials (slot);
notify pgrst, 'reload schema';
