ALTER TABLE public.generation_history
    ADD COLUMN IF NOT EXISTS credit_refunded boolean;

UPDATE public.generation_history
SET credit_refunded = (lower(COALESCE(status, '')) = 'failed')
WHERE credit_refunded IS NULL;

ALTER TABLE public.generation_history
    ALTER COLUMN credit_refunded SET DEFAULT false,
    ALTER COLUMN credit_refunded SET NOT NULL;

CREATE OR REPLACE FUNCTION public.refund_failed_generation_credits(
    p_user_id uuid,
    p_task_id text
)
RETURNS TABLE(refunded boolean, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    history_row public.generation_history%ROWTYPE;
    refund_amount numeric;
BEGIN
    SELECT *
    INTO history_row
    FROM public.generation_history
    WHERE user_id = p_user_id
      AND task_id = p_task_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR lower(COALESCE(history_row.status, '')) <> 'failed' THEN
        RETURN QUERY SELECT false, 0::numeric;
        RETURN;
    END IF;

    IF history_row.credit_refunded THEN
        RETURN QUERY SELECT true, COALESCE(history_row.credit_cost, 0);
        RETURN;
    END IF;

    refund_amount := GREATEST(COALESCE(history_row.credit_cost, 0), 0);

    IF refund_amount > 0 THEN
        PERFORM public.refund_generate_credits(p_user_id, refund_amount);
    END IF;

    UPDATE public.generation_history
    SET credit_refunded = true
    WHERE id = history_row.id;

    RETURN QUERY SELECT (refund_amount > 0), refund_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_failed_generation_credits(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_failed_generation_credits(uuid, text) TO service_role;
