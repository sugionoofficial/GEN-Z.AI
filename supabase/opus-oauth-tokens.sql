/* =========================================================
   GEN-Z.AI — OPUS OAUTH ROTATING REFRESH TOKEN VAULT
   ---------------------------------------------------------
   WorkOS AuthKit (focused-horizon-38.authkit.app/oauth2/token)
   menggunakan Single-Use Rotating Refresh Tokens: setiap kali
   refresh_token ditukar menjadi access_token baru, refresh_token
   lama langsung hangus (400 invalid_grant) dan digantikan oleh
   refresh_token baru.

   Karena Cloudflare Workers bersifat stateless & multi-isolate
   (memori RAM hilang saat isolate idle atau setelah deploy baru),
   pasangan { access_token, refresh_token } hasil rotasi terbaru
   disimpan secara persisten & terenkripsi AES-256-GCM di tabel ini,
   diindeks berdasarkan SHA-256 dari seed refresh_token awal di
   Cloudflare Secret (seed_hash).
========================================================= */

create table if not exists public.opus_oauth_tokens (
    seed_hash text primary key,
    token_ciphertext text not null,
    token_iv text not null,
    expires_at timestamptz null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_opus_oauth_tokens_updated_at
    on public.opus_oauth_tokens (updated_at desc);

alter table public.opus_oauth_tokens enable row level security;

revoke all on table public.opus_oauth_tokens from public;
revoke all on table public.opus_oauth_tokens from anon, authenticated;
grant all on table public.opus_oauth_tokens to service_role;
