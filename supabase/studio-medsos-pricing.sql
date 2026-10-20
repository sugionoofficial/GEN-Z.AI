create table if not exists public.studio_medsos_pricing (
  id boolean primary key default true check (id is true),
  price_idr bigint not null check (price_idr >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.studio_medsos_pricing enable row level security;
