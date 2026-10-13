create table if not exists public.feature_credit_settings (
    feature_id text primary key
        check (feature_id in (
            'vision',
            'vision_video',
            'upscale',
            'prompt_studio',
            'metadata_cleaner'
        )),
    credit_cost integer not null default 1
        check (credit_cost between 0 and 1000000),
    updated_at timestamptz not null default pg_catalog.now()
);

insert into public.feature_credit_settings (feature_id, credit_cost)
values
    ('vision', 1),
    ('vision_video', 1),
    ('upscale', 1),
    ('prompt_studio', 1),
    ('metadata_cleaner', 1)
on conflict (feature_id) do nothing;

alter table public.feature_credit_settings enable row level security;

revoke all on public.feature_credit_settings from public, anon, authenticated;
grant select on public.feature_credit_settings to authenticated;

drop policy if exists "Authenticated users read feature credit settings"
    on public.feature_credit_settings;
create policy "Authenticated users read feature credit settings"
    on public.feature_credit_settings
    for select
    to authenticated
    using (true);

create table if not exists public.feature_credit_transactions (
    transaction_id uuid primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    feature_id text not null
        references public.feature_credit_settings(feature_id),
    credit_cost integer not null check (credit_cost >= 0),
    status text not null check (status in ('charged', 'completed', 'refunded')),
    created_at timestamptz not null default pg_catalog.now(),
    settled_at timestamptz
);

create index if not exists feature_credit_transactions_user_created_idx
    on public.feature_credit_transactions (user_id, created_at desc);

alter table public.feature_credit_transactions enable row level security;
revoke all on public.feature_credit_transactions from public, anon, authenticated;

create or replace function public.charge_feature_credits(
    p_user_id uuid,
    p_feature_id text,
    p_transaction_id uuid
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
begin
    select settings.credit_cost
    into v_cost
    from public.feature_credit_settings as settings
    where settings.feature_id = p_feature_id;

    if not found then
        raise exception 'FEATURE_CREDIT_SETTING_NOT_FOUND';
    end if;

    select transaction_row.*
    into v_existing
    from public.feature_credit_transactions as transaction_row
    where transaction_row.transaction_id = p_transaction_id
    for update;

    if found then
        if v_existing.user_id <> p_user_id
            or v_existing.feature_id <> p_feature_id then
            raise exception 'FEATURE_CREDIT_TRANSACTION_CONFLICT';
        end if;

        if v_existing.status = 'refunded' then
            raise exception 'FEATURE_CREDIT_TRANSACTION_REFUNDED';
        end if;

        select profile.credits
        into v_credits
        from public.profiles as profile
        where profile.id = p_user_id;

        return jsonb_build_object(
            'transaction_id', p_transaction_id,
            'feature_id', p_feature_id,
            'cost', v_existing.credit_cost,
            'credits', v_credits,
            'status', v_existing.status
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
    else
        select profile.credits
        into v_credits
        from public.profiles as profile
        where profile.id = p_user_id;
    end if;

    return jsonb_build_object(
        'transaction_id', p_transaction_id,
        'feature_id', p_feature_id,
        'cost', v_cost,
        'credits', v_credits,
        'status', 'charged'
    );
end;
$$;

create or replace function public.settle_feature_credits(
    p_user_id uuid,
    p_transaction_id uuid,
    p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_transaction public.feature_credit_transactions%rowtype;
    v_credits numeric;
begin
    if p_outcome not in ('complete', 'refund') then
        raise exception 'INVALID_FEATURE_CREDIT_OUTCOME';
    end if;

    select transaction_row.*
    into v_transaction
    from public.feature_credit_transactions as transaction_row
    where transaction_row.transaction_id = p_transaction_id
      and transaction_row.user_id = p_user_id
    for update;

    if not found then
        raise exception 'FEATURE_CREDIT_TRANSACTION_NOT_FOUND';
    end if;

    if v_transaction.status = 'refunded' then
        if p_outcome = 'refund' then
            select profile.credits
            into v_credits
            from public.profiles as profile
            where profile.id = p_user_id;

            return jsonb_build_object(
                'transaction_id', p_transaction_id,
                'status', 'refunded',
                'credits', v_credits
            );
        end if;

        raise exception 'FEATURE_CREDIT_TRANSACTION_ALREADY_REFUNDED';
    end if;

    if v_transaction.status = 'completed' then
        if p_outcome = 'complete' then
            select profile.credits
            into v_credits
            from public.profiles as profile
            where profile.id = p_user_id;

            return jsonb_build_object(
                'transaction_id', p_transaction_id,
                'status', 'completed',
                'credits', v_credits
            );
        end if;

        raise exception 'FEATURE_CREDIT_TRANSACTION_ALREADY_COMPLETED';
    end if;

    if p_outcome = 'refund' and v_transaction.credit_cost > 0 then
        v_credits := public.refund_generate_credits(
            p_user_id,
            v_transaction.credit_cost
        );
    else
        select profile.credits
        into v_credits
        from public.profiles as profile
        where profile.id = p_user_id;
    end if;

    update public.feature_credit_transactions
    set status = case when p_outcome = 'refund' then 'refunded' else 'completed' end,
        settled_at = pg_catalog.now()
    where transaction_id = p_transaction_id;

    return jsonb_build_object(
        'transaction_id', p_transaction_id,
        'status', case when p_outcome = 'refund' then 'refunded' else 'completed' end,
        'credits', v_credits
    );
end;
$$;

revoke all on function public.charge_feature_credits(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.settle_feature_credits(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.charge_feature_credits(uuid, text, uuid) to service_role;
grant execute on function public.settle_feature_credits(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
