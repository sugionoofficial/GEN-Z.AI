-- =========================================================
-- GEN-Z.AI
-- ADMIN FORCE CANCEL GENERATION
-- ---------------------------------------------------------
-- File:
--   supabase/admin-cancel-generation.sql
--
-- Kenapa ada file ini:
--   Force cancel dari halaman User Activity sebelumnya
--   dilakukan langsung dari browser (UPDATE generation_history).
--   RLS memblokir update tersebut untuk baris milik user lain,
--   sehingga tombol "Cancel Generate" tidak berefek apa pun
--   pada task yang masih processing.
--
--   Fungsi di bawah dijalankan dengan service role lewat
--   api/admin-cancel-generation.js, jadi bisa membatalkan
--   task milik user mana pun, sekaligus:
--     - menandai status cancelled + completed_at
--     - mengembalikan credit user (kalau belum direfund)
--
-- Aman dijalankan berulang (idempotent).
-- =========================================================


create or replace function public.admin_cancel_generation(
    p_history_id uuid,
    p_reason text default null
)
returns table (
    id uuid,
    status text,
    previous_status text,
    cancelled boolean,
    credit_refunded boolean,
    refund_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.generation_history%rowtype;
    v_previous text;
    v_reason text;
    v_refund numeric := 0;
    v_refunded boolean := false;
begin

    select *
      into v_row
      from public.generation_history gh
     where gh.id = p_history_id
     for update;


    if not found then

        return query
        select
            p_history_id,
            null::text,
            null::text,
            false,
            false,
            0::numeric;

        return;

    end if;


    v_previous :=
        lower(
            coalesce(v_row.status, '')
        );


    /*
     * Task yang sudah selesai / gagal / batal tidak perlu
     * dibatalkan lagi.
     */

    if v_previous not in (
        'processing',
        'pending',
        'queued',
        'running'
    ) then

        return query
        select
            v_row.id,
            v_row.status,
            v_row.status,
            false,
            coalesce(v_row.credit_refunded, false),
            0::numeric;

        return;

    end if;


    v_reason :=
        coalesce(
            nullif(
                btrim(
                    coalesce(p_reason, '')
                ),
                ''
            ),
            'Dibatalkan oleh admin'
        );


    update public.generation_history
       set status = 'cancelled',
           completed_at = now(),
           error_message = v_reason
     where id = v_row.id;


    /*
     * Credit user dikembalikan karena hasil tidak pernah
     * diterima. Pakai helper refund yang sudah ada supaya
     * saldo + mutasi credit tetap konsisten.
     */

    if
        not coalesce(v_row.credit_refunded, false) and
        coalesce(v_row.credit_cost, 0) > 0
    then

        begin

            perform public.refund_generate_credits(
                v_row.user_id,
                v_row.credit_cost
            );

            v_refund :=
                v_row.credit_cost;

            v_refunded :=
                true;

        exception
            when others then

                /*
                 * Refund gagal tidak boleh membatalkan proses
                 * cancel. Task tetap dibatalkan, admin diberi
                 * tahu lewat refund_amount = 0.
                 */

                raise warning
                    'admin_cancel_generation refund failed: %',
                    sqlerrm;

                v_refund :=
                    0;

                v_refunded :=
                    false;

        end;

        if v_refunded then

            update public.generation_history
               set credit_refunded = true
             where id = v_row.id;

        end if;

    end if;


    return query
    select
        v_row.id,
        'cancelled'::text,
        v_previous,
        true,
        v_refunded,
        v_refund;

end;
$$;


revoke all on function public.admin_cancel_generation(uuid, text)
    from public, anon, authenticated;

grant execute on function public.admin_cancel_generation(uuid, text)
    to service_role;


-- =========================================================
-- VERIFIKASI
-- =========================================================

-- select * from public.admin_cancel_generation(
--     '<generation_history_id>'::uuid,
--     'Dibatalkan oleh admin'
-- );
