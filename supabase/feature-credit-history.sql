/* =========================================================
   GEN-Z.AI — FEATURE CREDIT HISTORY SYNC & BACKFILL
   ---------------------------------------------------------
   1. Menyinkronkan pemotongan & refund semua fitur credit
      (metadata_cleaner, prompt_studio, vision, vision_video,
      upscale, upscale_video) ke public.generation_history.
   2. Memastikan refund_generate_credits dari workflow GitHub
      Actions (upscale.yml & upscale-photo.yml) ikut menandai
      credit_refunded = true pada baris upscale yang gagal/batal.
   3. Backfill idempotent untuk transaksi feature_credit_transactions
      berbayar (credit_cost > 0) yang belum masuk ke generation_history,
      serta menormalisasi model_id/model_name baris upscale video lama.
========================================================= */

create or replace function public.refund_generate_credits(
    p_user_id uuid,
    p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_new_credits numeric;
begin
    if p_user_id is null then
        raise exception 'INVALID_USER_ID';
    end if;

    if p_amount is null then
        raise exception 'INVALID_CREDIT_AMOUNT';
    end if;

    if p_amount < 0 then
        raise exception 'INVALID_CREDIT_AMOUNT';
    end if;

    update public.profiles
       set credits = coalesce(credits, 0) + p_amount
     where id = p_user_id
    returning credits into v_new_credits;

    if not found then
        raise exception 'USER_PROFILE_NOT_FOUND';
    end if;

    /* Sinkronkan credit_refunded = true untuk job upscale foto/video
       yang baru saja ditandai failed/cancelled oleh worker eksternal
       sebelum memanggil refund_generate_credits. */
    if p_amount > 0 then
        update public.generation_history as gh
           set credit_refunded = true,
               completed_at = coalesce(gh.completed_at, now())
         where gh.id = (
             select candidate.id
               from public.generation_history as candidate
              where candidate.user_id = p_user_id
                and candidate.credit_refunded = false
                and candidate.credit_cost = p_amount
                and lower(coalesce(candidate.status, '')) in ('failed', 'cancelled', 'canceled')
                and (
                    lower(coalesce(candidate.model_id, '')) in ('upscale-photo', 'upscale-video')
                    or coalesce(candidate.task_id, '') like 'upscale_%'
                    or coalesce(candidate.task_id, '') like 'upscale-photo_%'
                    or candidate.upscale_of_history_id is not null
                )
                and coalesce(candidate.completed_at, candidate.created_at) >= now() - interval '2 hours'
              order by coalesce(candidate.completed_at, candidate.created_at) desc
              limit 1
              for update skip locked
         );
    end if;

    return v_new_credits;
end;
$function$;

/* Backfill idempotent untuk transaksi fitur berbayar yang belum tercatat
   di public.generation_history */
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
select
    fct.user_id,
    p.email,
    d.provider_id,
    d.provider_name,
    d.model_id,
    d.model_name,
    d.default_prompt,
    case
        when fct.status = 'completed' then 'success'
        when fct.status = 'refunded' then 'failed'
        else 'processing'
    end,
    d.task_id,
    fct.credit_cost,
    (fct.status = 'refunded' and fct.credit_cost > 0),
    fct.created_at,
    coalesce(fct.settled_at, case when fct.status in ('completed', 'refunded') then fct.created_at else null end),
    case
        when fct.status = 'refunded' then 'Proses gagal; credit telah dikembalikan.'
        else null
    end
from public.feature_credit_transactions as fct
cross join lateral public.get_feature_history_defaults(fct.feature_id, fct.transaction_id) as d
left join public.profiles as p
    on p.id = fct.user_id
where fct.credit_cost > 0
  and not exists (
      select 1
        from public.generation_history as gh
       where gh.user_id = fct.user_id
         and (
             gh.task_id = d.task_id
             or gh.task_id like '%' || fct.transaction_id::text || '%'
         )
  );

/* Normalisasi baris Upscale Video dari modal History yang sebelumnya
   menyalin model_id milik video sumber */
update public.generation_history
   set provider_id = 'genzai-internal',
       provider_name = 'GEN-Z.AI',
       model_id = 'upscale-video',
       model_name = 'Upscale Video'
 where upscale_of_history_id is not null
   and coalesce(task_id, '') like 'upscale_%'
   and coalesce(model_id, '') <> 'upscale-video';
