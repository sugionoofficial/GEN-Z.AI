-- Status kredit per akun Opus; bukan kredensial dan aman ditampilkan sebagai badge admin.
alter table public.opus_credentials
    add column if not exists credit_status text not null default 'unknown';

alter table public.opus_credentials
    add column if not exists credit_status_updated_at timestamptz;

comment on column public.opus_credentials.credit_status is
    'Status terakhir dari hasil generate Studio Medsos: unknown, available, atau exhausted.';
comment on column public.opus_credentials.credit_status_updated_at is
    'Waktu status kredit terakhir diperbarui oleh generate Studio Medsos.';

notify pgrst, 'reload schema';
