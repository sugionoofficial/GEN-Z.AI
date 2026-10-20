create table if not exists public.studio_medsos_pricing (
  id boolean primary key default true check (id is true),
  price_idr bigint not null default 0 check (price_idr >= 0),
  price_daily_idr bigint check (price_daily_idr is null or price_daily_idr >= 0),
  price_weekly_idr bigint check (price_weekly_idr is null or price_weekly_idr >= 0),
  price_monthly_idr bigint check (price_monthly_idr is null or price_monthly_idr >= 0),
  price_yearly_idr bigint check (price_yearly_idr is null or price_yearly_idr >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.studio_medsos_pricing
  add column if not exists price_daily_idr bigint check (price_daily_idr is null or price_daily_idr >= 0),
  add column if not exists price_weekly_idr bigint check (price_weekly_idr is null or price_weekly_idr >= 0),
  add column if not exists price_monthly_idr bigint check (price_monthly_idr is null or price_monthly_idr >= 0),
  add column if not exists price_yearly_idr bigint check (price_yearly_idr is null or price_yearly_idr >= 0);

alter table public.studio_medsos_pricing enable row level security;
