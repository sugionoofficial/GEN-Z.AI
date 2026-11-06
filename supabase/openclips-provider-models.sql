-- GEN-Z.AI — OpenClips provider + initial verified marketplace models.
-- Idempotent: safe to run repeatedly. Existing admin-edited credit values and
-- model status are preserved on conflict.
--
-- Credentials are NOT seeded here. Use Admin → Providers → OpenClips, or
-- OPENCLIPS_AUTH_TOKEN / OPENCLIPS_API_KEY, or the JSON bundle produced by
-- /api/openclips-oauth-login. OAuth refresh rotation uses
-- public.openclips_oauth_tokens (see openclips-oauth-tokens.sql).
--
-- credit_* below are GEN-Z.AI's editable internal sale prices, NOT a claim
-- about OpenClips upstream pricing. OpenClips usage is quoted at runtime via
-- its marketplace preview_cost route before dispatch.

alter table public.models
    add column if not exists supported_durations text[];

insert into public.providers (
    provider_id,
    provider_name,
    description,
    status,
    is_default
)
values (
    'openclips',
    'OpenClips',
    'OpenClips Marketplace melalui MCP https://mcp.openclips.ai — OAuth PKCE, API key/Bearer token, refresh-token vault, preview_cost, generation, dan creative polling. Login: /api/openclips-oauth-login.',
    'active',
    false
)
on conflict (provider_id) do update
set
    provider_name = excluded.provider_name,
    description = excluded.description,
    status = excluded.status;

with provider as (
    select id
    from public.providers
    where provider_id = 'openclips'
    limit 1
),
seed (
    model_id,
    model_name,
    description,
    min_duration,
    max_duration,
    supported_ratios,
    supported_resolutions,
    supported_durations,
    credit_480p,
    credit_720p,
    credit_1080p
) as (
    values
        (
            'openclips-seedance-2.5',
            'Seedance 2.5 (OpenClips)',
            'Seedance 2.5 melalui OpenClips MCP — text/reference to video, 4–30 detik, hingga 1080p, audio native, hingga 30 gambar referensi.',
            4, 30, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{720p,480p,1080p}', '{4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}', 15, 25, 45
        ),
        (
            'openclips-seedance-2.0',
            'Seedance 2.0 (OpenClips)',
            'Seedance 2.0 melalui OpenClips MCP — text/reference to video, 4–15 detik, audio native, hingga 30 gambar referensi.',
            4, 15, '{9:16,16:9,1:1,4:3,3:4,21:9}', '{720p,480p,1080p}', '{4,5,6,7,8,9,10,11,12,13,14,15}', 12, 20, 40
        ),
        (
            'openclips-seedream-5.0-pro',
            'Seedream 5.0 Pro (OpenClips)',
            'Seedream 5.0 Pro melalui OpenClips MCP — text/image to image, hingga 10 referensi, ukuran 1K/1.5K/2K, PNG atau JPEG.',
            null, null, '{1:1,9:16,16:9}', '{}', '{}', 500, 0, 0
        ),
        (
            'openclips-seedream-5.0-flash',
            'Seedream 5.0 Flash (OpenClips)',
            'Seedream 5.0 Flash melalui OpenClips MCP — text/image to image cepat, hingga 10 referensi, ukuran 1K/1.5K/2K, PNG atau JPEG.',
            null, null, '{1:1,9:16,16:9}', '{}', '{}', 500, 0, 0
        )
)
insert into public.models (
    provider_id,
    model_id,
    model_name,
    description,
    min_duration,
    max_duration,
    supported_ratios,
    supported_resolutions,
    supported_durations,
    credit_480p,
    credit_720p,
    credit_1080p,
    discount_percent,
    status
)
select
    provider.id,
    seed.model_id,
    seed.model_name,
    seed.description,
    seed.min_duration,
    seed.max_duration,
    seed.supported_ratios::text[],
    seed.supported_resolutions::text[],
    seed.supported_durations::text[],
    seed.credit_480p,
    seed.credit_720p,
    seed.credit_1080p,
    0,
    'active'
from seed
cross join provider
on conflict (provider_id, model_id) do update
set
    model_name = excluded.model_name,
    description = excluded.description,
    min_duration = excluded.min_duration,
    max_duration = excluded.max_duration,
    supported_ratios = excluded.supported_ratios,
    supported_resolutions = excluded.supported_resolutions,
    supported_durations = coalesce(public.models.supported_durations, excluded.supported_durations);
