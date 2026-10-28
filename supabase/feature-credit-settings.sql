/* =========================================================
   GEN-Z.AI — FEATURE CREDIT SETTINGS & TRANSACTIONS
   ---------------------------------------------------------
   Tarif credit dinamis yang diatur admin untuk fitur:
   - metadata_cleaner  (AI Metadata Cleaner)
   - prompt_studio     (Studio Prompt)
   - vision            (Vision Image)
   - vision_video      (Vision Video)
   - upscale           (Upscale Foto)
   - upscale_video     (Upscale Video)

   Setiap pemotongan dan penyelesaian/refund credit fitur
   juga disinkronkan secara atomik ke public.generation_history
   agar selalu tercatat di halaman History (/history) dan
   Riwayat Pemakaian Credit (/credit).
========================================================= */

create table if not exists public.feature_credit_settings (
    feature_id text primary key,
    label text not null,
    credit_cost integer not null default 0 check (credit_cost >= 0),
    updated_at timestamptz not null default now(),
    updated_by uuid null
);

insert into public.feature_credit_settings (feature_id, label, credit_cost)
values
    ('metadata_cleaner', 'AI Metadata Cleaner', 0),
    ('prompt_studio', 'Studio Prompt', 0),
    ('vision', 'Vision Image', 0),
    ('vision_video', 'Vision Video', 0),
    ('upscale', 'Upscale Foto', 0),
    ('upscale_video', 'Upscale Video', 0)
on conflict (feature_id) do update
set label = excluded.label;

alter table public.feature_credit_settings enable row level security;

drop policy if exists "Public can read feature credit settings" on public.feature_credit_settings;
create policy "Public can read feature credit settings"
    on public.feature_credit_settings
    for select
    to anon, authenticated
    using (true);

create table if not exists public.feature_credit_transactions (
    transaction_id uuid primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    feature_id text not null references public.feature_credit_settings(feature_id),
    credit_cost integer not null default 0 check (credit_cost >= 0),
    status text not null default 'charged' check (status in ('charged', 'completed', 'refunded')),
    created_at timestamptz not null default now(),
    settled_at timestamptz null
);

create index if not exists feature_credit_transactions_user_created_idx
    on public.feature_credit_transactions (user_id, created_at desc);

alter table public.feature_credit_transactions enable row level security;

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

drop function if exists public.charge_feature_credits(uuid, text, uuid);

create or replace function public.charge_feature_credits(
    p_user_id uuid,
    p_feature_id text,
    p_transaction_id uuid,
    p_prompt text default null,
    p_model_id text default null,
    p_model_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cost integer;
    v_credits numeric;
    v_existing public.feature_credit_transactions%rowtype;
    v_defaults record;
    v_user_email text;
    v_history_id uuid;
begin
    if p_user_id is null then
        raise exception 'INVALID_USER_ID';
    end if;

    if p_transaction_id is null then
        raise exception 'INVALID_TRANSACTION_ID';
    end if;

    select credit_cost
    into v_cost
    from public.feature_credit_settings
    where feature_id = p_feature_id;

    if not found then
        raise exception 'UNKNOWN_FEATURE_ID';
    end if;

    select *
    into v_defaults
    from public.get_feature_history_defaults(p_feature_id, p_transaction_id);

    select *
    into v_existing
    from public.feature_credit_transactions
    where transaction_id = p_transaction_id
    for update;

    if found then
        if v_existing.user_id <> p_user_id or v_existing.feature_id <> p_feature_id then
            raise exception 'TRANSACTION_MISMATCH';
        end if;

        select coalesce(credits, 0), email
        into v_credits, v_user_email
        from public.profiles
        where id = p_user_id;

        select id
        into v_history_id
        from public.generation_history
        where user_id = p_user_id
          and task_id = v_defaults.task_id
        order by created_at desc
        limit 1;

        if v_history_id is null then
            insert into public.generation_history (
                user_id,
                user_email,
                provider_id,
                provider_name,
                model_id,
                model_name,
                prompt,
                status,
                task_id,
                credit_cost,
                credit_refunded,
                created_at,
                completed_at
            )
            values (
                p_user_id,
                v_user_email,
                v_defaults.provider_id,
                v_defaults.provider_name,
                coalesce(nullif(btrim(p_model_id), ''), v_defaults.model_id),
                coalesce(nullif(btrim(p_model_name), ''), v_defaults.model_name),
                coalesce(nullif(btrim(p_prompt), ''), v_defaults.default_prompt),
                case
                    when v_existing.status = 'completed' then 'success'
                    when v_existing.status = 'refunded' then 'failed'
                    else 'processing'
                end,
                v_defaults.task_id,
                v_existing.credit_cost,
                (v_existing.status = 'refunded' and v_existing.credit_cost > 0),
                v_existing.created_at,
                v_existing.settled_at
            )
            returning id into v_history_id;
        end if;

        return jsonb_build_object(
            'transaction_id', v_existing.transaction_id,
            'feature_id', v_existing.feature_id,
            'cost', v_existing.credit_cost,
            'credits', coalesce(v_credits, 0),
            'status', v_existing.status,
            'history_id', v_history_id,
            'task_id', v_defaults.task_id
        );
    end if;

    insert into public.feature_credit_transactions (
        transaction_id,
        user_id,
        feature_id,
        credit_cost,
        status
    )
    values (
        p_transaction_id,
        p_user_id,
        p_feature_id,
        v_cost,
        'charged'
    );

    if v_cost > 0 then
        v_credits := public.deduct_generate_credits(p_user_id, v_cost);
        select email
        into v_user_email
        from public.profiles
        where id = p_user_id;
    else
        select coalesce(credits, 0), email
        into v_credits, v_user_email
        from public.profiles
        where id = p_user_id;

        if not found then
            raise exception 'USER_PROFILE_NOT_FOUND';
        end if;
    end if;

    insert into public.generation_history (
        user_id,
        user_email,
        provider_id,
        provider_name,
        model_id,
        model_name,
        prompt,
        status,
        task_id,
        credit_cost,
        credit_refunded
    )
    values (
        p_user_id,
        v_user_email,
        v_defaults.provider_id,
        v_defaults.provider_name,
        coalesce(nullif(btrim(p_model_id), ''), v_defaults.model_id),
        coalesce(nullif(btrim(p_model_name), ''), v_defaults.model_name),
        coalesce(nullif(btrim(p_prompt), ''), v_defaults.default_prompt),
        'processing',
        v_defaults.task_id,
        v_cost,
        false
    )
    returning id into v_history_id;

    return jsonb_build_object(
        'transaction_id', p_transaction_id,
        'feature_id', p_feature_id,
        'cost', v_cost,
        'credits', coalesce(v_credits, 0),
        'status', 'charged',
        'history_id', v_history_id,
        'task_id', v_defaults.task_id
    );
end;
$$;

drop function if exists public.settle_feature_credits(uuid, uuid, text);

create or replace function public.settle_feature_credits(
    p_user_id uuid,
    p_transaction_id uuid,
    p_outcome text,
    p_error_message text default null,
    p_prompt text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_transaction public.feature_credit_transactions%rowtype;
    v_credits numeric;
    v_defaults record;
    v_user_email text;
    v_history_id uuid;
    v_final_status text;
    v_history_status text;
    v_refunded boolean;
begin
    if p_user_id is null then
        raise exception 'INVALID_USER_ID';
    end if;

    if p_transaction_id is null then
        raise exception 'INVALID_TRANSACTION_ID';
    end if;

    if p_outcome not in ('complete', 'refund') then
        raise exception 'INVALID_SETTLEMENT_OUTCOME';
    end if;

    select *
    into v_transaction
    from public.feature_credit_transactions
    where transaction_id = p_transaction_id
    for update;

    if not found then
        raise exception 'TRANSACTION_NOT_FOUND';
    end if;

    if v_transaction.user_id <> p_user_id then
        raise exception 'TRANSACTION_MISMATCH';
    end if;

    select *
    into v_defaults
    from public.get_feature_history_defaults(v_transaction.feature_id, p_transaction_id);

    if v_transaction.status in ('refunded', 'completed') then
        select coalesce(credits, 0), email
        into v_credits, v_user_email
        from public.profiles
        where id = p_user_id;

        v_history_status := case when v_transaction.status = 'refunded' then 'failed' else 'success' end;
        v_refunded := (v_transaction.status = 'refunded' and v_transaction.credit_cost > 0);

        update public.generation_history
           set status = case
                   when lower(coalesce(status, '')) in ('processing', 'pending', 'queued') then v_history_status
                   else status
               end,
               credit_refunded = (credit_refunded or v_refunded),
               completed_at = coalesce(completed_at, v_transaction.settled_at, pg_catalog.now()),
               prompt = coalesce(nullif(btrim(p_prompt), ''), prompt),
               error_message = case
                   when v_transaction.status = 'refunded'
                   then coalesce(nullif(btrim(p_error_message), ''), nullif(btrim(error_message), ''), 'Proses gagal; credit telah dikembalikan.')
                   else error_message
               end
         where user_id = p_user_id
           and task_id = v_defaults.task_id
        returning id into v_history_id;

        return jsonb_build_object(
            'transaction_id', v_transaction.transaction_id,
            'feature_id', v_transaction.feature_id,
            'cost', v_transaction.credit_cost,
            'credits', coalesce(v_credits, 0),
            'status', v_transaction.status,
            'history_id', v_history_id,
            'task_id', v_defaults.task_id
        );
    end if;

    if p_outcome = 'refund' then
        if v_transaction.credit_cost > 0 then
            v_credits := public.refund_generate_credits(
                p_user_id,
                v_transaction.credit_cost
            );
        else
            select coalesce(credits, 0)
            into v_credits
            from public.profiles
            where id = p_user_id;
        end if;
        v_final_status := 'refunded';
        v_history_status := 'failed';
        v_refunded := (v_transaction.credit_cost > 0);
    else
        select coalesce(credits, 0)
        into v_credits
        from public.profiles
        where id = p_user_id;
        v_final_status := 'completed';
        v_history_status := 'success';
        v_refunded := false;
    end if;

    update public.feature_credit_transactions
       set status = v_final_status,
           settled_at = pg_catalog.now()
     where transaction_id = p_transaction_id;

    update public.generation_history
       set status = v_history_status,
           credit_refunded = v_refunded,
           completed_at = coalesce(completed_at, pg_catalog.now()),
           prompt = coalesce(nullif(btrim(p_prompt), ''), prompt),
           error_message = case
               when p_outcome = 'refund'
               then coalesce(nullif(btrim(p_error_message), ''), nullif(btrim(error_message), ''), 'Proses gagal; credit telah dikembalikan.')
               else error_message
           end
     where user_id = p_user_id
       and task_id = v_defaults.task_id
    returning id into v_history_id;

    if v_history_id is null then
        select email
        into v_user_email
        from public.profiles
        where id = p_user_id;

        insert into public.generation_history (
            user_id,
            user_email,
            provider_id,
            provider_name,
            model_id,
            model_name,
            prompt,
            status,
            task_id,
            credit_cost,
            credit_refunded,
            created_at,
            completed_at,
            error_message
        )
        values (
            p_user_id,
            v_user_email,
            v_defaults.provider_id,
            v_defaults.provider_name,
            v_defaults.model_id,
            v_defaults.model_name,
            coalesce(nullif(btrim(p_prompt), ''), v_defaults.default_prompt),
            v_history_status,
            v_defaults.task_id,
            v_transaction.credit_cost,
            v_refunded,
            v_transaction.created_at,
            pg_catalog.now(),
            case
                when p_outcome = 'refund'
                then coalesce(nullif(btrim(p_error_message), ''), 'Proses gagal; credit telah dikembalikan.')
                else null
            end
        )
        returning id into v_history_id;
    end if;

    return jsonb_build_object(
        'transaction_id', p_transaction_id,
        'feature_id', v_transaction.feature_id,
        'cost', v_transaction.credit_cost,
        'credits', coalesce(v_credits, 0),
        'status', v_final_status,
        'history_id', v_history_id,
        'task_id', v_defaults.task_id
    );
end;
$$;

revoke all on function public.get_feature_history_defaults(text, uuid) from public, anon, authenticated;
grant execute on function public.get_feature_history_defaults(text, uuid) to service_role;

revoke all on function public.charge_feature_credits(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.charge_feature_credits(uuid, text, uuid, text, text, text) to service_role;

revoke all on function public.settle_feature_credits(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.settle_feature_credits(uuid, uuid, text, text, text) to service_role;
