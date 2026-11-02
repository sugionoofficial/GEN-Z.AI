/* =========================================================
   GEN-Z.AI — REMOVE OPUSCLIP STUDIO / STUDIO MEDSOS SOCIAL OAUTH
   ---------------------------------------------------------
   File:
     supabase/remove-opusclip-studio.sql

   Migration aditif & non-destruktif:
   - Menambah tarif netral `social_video_post` untuk Social Video
     Auto Post (menggantikan penggunaan baru `opusclip_social_post`).
   - Mengarahkan default/pending OAuth state ke Studio Medsos.
   - Tidak menghapus transaksi, history, akun terhubung, atau vault
     lama agar data pengguna tetap aman.
========================================================= */

alter table public.feature_credit_settings
    drop constraint if exists feature_credit_settings_feature_id_check;

alter table public.feature_credit_settings
    add constraint feature_credit_settings_feature_id_check
    check (
        feature_id in (
            'vision',
            'vision_video',
            'upscale',
            'upscale_video',
            'prompt_studio',
            'metadata_cleaner',
            'social_video_post',
            -- Legacy ids: hanya untuk integritas transaksi/history lama.
            'opusclip_clipping',
            'opusclip_dubbing',
            'opusclip_thumbnail',
            'opusclip_censor_edit',
            'opusclip_understanding',
            'opusclip_motion_ui',
            'opusclip_social_post'
        )
    );

update public.feature_credit_settings
set label = 'Social Video Auto Post (FB / YouTube / TikTok)'
where feature_id = 'social_video_post';

insert into public.feature_credit_settings (feature_id, label, credit_cost)
select
    'social_video_post',
    'Social Video Auto Post (FB / YouTube / TikTok)',
    coalesce((
        select credit_cost
        from public.feature_credit_settings
        where feature_id = 'opusclip_social_post'
        limit 1
    ), 250)
where not exists (
    select 1
    from public.feature_credit_settings
    where feature_id = 'social_video_post'
);


alter table public.social_video_oauth_states
    alter column return_path set default '/admin-control/social-publisher.html#social-connections';

update public.social_video_oauth_states
set return_path = '/admin-control/social-publisher.html#social-connections'
where return_path like '/opusclip%';

create or replace function public.get_feature_history_defaults(
    p_feature_id text,
    p_transaction_id uuid
)
returns table(
    provider_id text,
    provider_name text,
    model_id text,
    model_name text,
    default_prompt text,
    task_id text
)
language plpgsql
immutable
set search_path = ''
as $$
declare
    v_feature text := lower(btrim(coalesce(p_feature_id, '')));
    v_tx text := coalesce(p_transaction_id::text, '');
begin
    case v_feature
        when 'metadata_cleaner' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'metadata-cleaner'::text,
                'AI Metadata Cleaner'::text,
                'Pemeriksaan / pembersihan metadata file'::text,
                ('feature:metadata_cleaner:' || v_tx)::text;
        when 'prompt_studio' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'prompt-studio'::text,
                'Studio Prompt'::text,
                'Salin prompt dari Studio Prompt'::text,
                ('feature:prompt_studio:' || v_tx)::text;
        when 'vision' then
            return query select
                'openkey'::text,
                'GEN-Z.AI'::text,
                'vision-image'::text,
                'Vision Image'::text,
                'Analisis gambar & rekonstruksi prompt'::text,
                ('vision-' || v_tx)::text;
        when 'vision_video' then
            return query select
                'openkey'::text,
                'GEN-Z.AI'::text,
                'vision-video'::text,
                'Vision Video'::text,
                'Analisis video & rekonstruksi prompt'::text,
                ('vision-video-' || v_tx)::text;
        when 'upscale' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'upscale-photo'::text,
                'Upscale Photo'::text,
                'Upscale Foto'::text,
                ('upscale-photo_' || v_tx)::text;
        when 'upscale_video' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'upscale-video'::text,
                'Upscale Video'::text,
                'Upscale Video'::text,
                ('upscale_' || v_tx)::text;
        when 'social_video_post' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'social-video-autopost'::text,
                'Social Video Auto Post (FB/YT/TikTok)'::text,
                'Publikasi / jadwal otomatis video ke Facebook, YouTube, atau TikTok'::text,
                ('socvid_' || v_tx)::text;
        when 'opusclip_clipping' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-ai-clipping'::text,
                'OpusClip AI Video Clipping'::text,
                'Potong video panjang otomatis menjadi klip Shorts/Reels/TikTok'::text,
                ('opusclip_clip_' || v_tx)::text;
        when 'opusclip_dubbing' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-ai-dubbing'::text,
                'OpusClip AI Video Dubbing'::text,
                'Sulih suara AI video lintas bahasa'::text,
                ('opusclip_dub_' || v_tx)::text;
        when 'opusclip_thumbnail' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-youtube-thumbnail'::text,
                'OpusClip AI YouTube Thumbnail'::text,
                'Generate desain thumbnail YouTube AI'::text,
                ('opusclip_thumb_' || v_tx)::text;
        when 'opusclip_censor_edit' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-censor-edit'::text,
                'OpusClip Edit & Sensor Klip'::text,
                'Sensor kata kasar / edit naskah klip server-side'::text,
                ('opusclip_edit_' || v_tx)::text;
        when 'opusclip_understanding' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-video-understanding'::text,
                'OpusClip Deep Video Understanding'::text,
                'Analisis mendalam gaya editing video referensi'::text,
                ('opusclip_und_' || v_tx)::text;
        when 'opusclip_motion_ui' then
            return query select
                'opusclip'::text,
                'OpusClip'::text,
                'opusclip-motion-ui'::text,
                'OpusClip Motion UI Video'::text,
                'Render video animasi produk/UI Remotion'::text,
                ('opusclip_mui_' || v_tx)::text;
        when 'opusclip_social_post' then
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                'social-video-autopost'::text,
                'Social Video Auto Post (FB/YT/TikTok)'::text,
                'Publikasi / jadwal otomatis video ke Facebook, YouTube, atau TikTok'::text,
                ('socvid_' || v_tx)::text;
        else
            return query select
                'genzai-internal'::text,
                'GEN-Z.AI'::text,
                coalesce(nullif(replace(v_feature, '_', '-'), ''), 'feature-credit')::text,
                coalesce(nullif(initcap(replace(v_feature, '_', ' ')), ''), 'Feature Credit')::text,
                'Pemakaian fitur GEN-Z.AI'::text,
                ('feature:' || coalesce(nullif(v_feature, ''), 'unknown') || ':' || v_tx)::text;
    end case;
end;
$$;

-- Nonaktifkan provider lama OpusClip Studio di katalog admin tanpa menghapus
-- vault/credential lama, sehingga tidak muncul sebagai provider aktif baru.
update public.providers
set status = 'inactive',
    description = coalesce(nullif(description, ''), provider_name) || ' (Legacy OpusClip Studio — dinonaktifkan.)'
where provider_id in ('opusclip', 'opusclip_mcp')
  and status <> 'inactive';

notify pgrst, 'reload schema';
