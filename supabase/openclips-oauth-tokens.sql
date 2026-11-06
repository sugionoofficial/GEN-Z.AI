/* GEN-Z.AI — OpenClips rotating OAuth token vault.
 * The seed hash identifies the original credential without storing it in
 * plaintext. Token payloads are encrypted with AES-256-GCM by the Worker.
 * Browser roles have no access; only the service role can read/write.
 */

create table if not exists public.openclips_oauth_tokens (
    seed_hash text primary key,
    token_ciphertext text not null,
    token_iv text not null,
    expires_at timestamptz null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_openclips_oauth_tokens_updated_at
    on public.openclips_oauth_tokens (updated_at desc);

alter table public.openclips_oauth_tokens enable row level security;

revoke all on table public.openclips_oauth_tokens from public;
revoke all on table public.openclips_oauth_tokens from anon, authenticated;
grant all on table public.openclips_oauth_tokens to service_role;
