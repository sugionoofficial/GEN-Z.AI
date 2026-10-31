CREATE TABLE IF NOT EXISTS public.topup_payment_methods (
    method text PRIMARY KEY,
    display_name text NOT NULL,
    account_number text NOT NULL DEFAULT '',
    account_name text NOT NULL DEFAULT '',
    qr_image_url text NOT NULL DEFAULT '',
    asset_symbol text NOT NULL DEFAULT '',
    network text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topup_payment_methods
    ADD COLUMN IF NOT EXISTS asset_symbol text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT '';

ALTER TABLE public.topup_payment_methods
    DROP CONSTRAINT IF EXISTS topup_payment_methods_method_check;

ALTER TABLE public.topup_payment_methods
    ADD CONSTRAINT topup_payment_methods_method_check
    CHECK (
        method IN (
            'bca',
            'dana',
            'seabank',
            'qris',
            'usdt_bep20',
            'usdt_trc20',
            'usdt_polygon',
            'trx',
            'btc',
            'pol',
            'bnb'
        )
    );

INSERT INTO public.topup_payment_methods (
    method,
    display_name,
    asset_symbol,
    network,
    is_active
)
VALUES
    ('bca', 'BCA', 'IDR', 'Bank Transfer', false),
    ('dana', 'DANA', 'IDR', 'E-Wallet', false),
    ('seabank', 'SeaBank', 'IDR', 'Bank Transfer', false),
    ('qris', 'QRIS', 'IDR', 'QRIS Nasional', false),
    ('usdt_bep20', 'USDT (BNB Smart Chain)', 'USDT', 'BNB Smart Chain (BEP-20)', false),
    ('usdt_trc20', 'USDT (TRON TRC-20)', 'USDT', 'TRON (TRC-20)', false),
    ('usdt_polygon', 'USDT (Polygon)', 'USDT', 'Polygon POS', false),
    ('trx', 'TRX (TRON)', 'TRX', 'TRON (TRC-20)', false),
    ('btc', 'BTC (Bitcoin)', 'BTC', 'Bitcoin (BTC)', false),
    ('pol', 'POL (Polygon)', 'POL', 'Polygon POS', false),
    ('bnb', 'BNB (Smart Chain)', 'BNB', 'BNB Smart Chain (BEP-20)', false)
ON CONFLICT (method) DO UPDATE
SET
    asset_symbol = EXCLUDED.asset_symbol,
    network = EXCLUDED.network;

ALTER TABLE public.credit_packages
    ADD COLUMN IF NOT EXISTS crypto_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS crypto_prices jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.credit_packages
    DROP CONSTRAINT IF EXISTS credit_packages_crypto_prices_object_check;

ALTER TABLE public.credit_packages
    ADD CONSTRAINT credit_packages_crypto_prices_object_check
    CHECK (jsonb_typeof(crypto_prices) = 'object');

ALTER TABLE public.topup_payments
    ADD COLUMN IF NOT EXISTS crypto_symbol text,
    ADD COLUMN IF NOT EXISTS crypto_network text,
    ADD COLUMN IF NOT EXISTS crypto_amount numeric(24, 8),
    ADD COLUMN IF NOT EXISTS tx_hash text;

ALTER TABLE public.topup_payments
    DROP CONSTRAINT IF EXISTS topup_payments_payment_method_check;

ALTER TABLE public.topup_payments
    ADD CONSTRAINT topup_payments_payment_method_check
    CHECK (
        payment_method IN (
            'bca',
            'dana',
            'seabank',
            'qris',
            'usdt_bep20',
            'usdt_trc20',
            'usdt_polygon',
            'trx',
            'btc',
            'pol',
            'bnb'
        )
    );

ALTER TABLE public.topup_payments
    DROP CONSTRAINT IF EXISTS topup_payments_crypto_amount_check;

ALTER TABLE public.topup_payments
    ADD CONSTRAINT topup_payments_crypto_amount_check
    CHECK (crypto_amount IS NULL OR crypto_amount > 0);

ALTER TABLE public.topup_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read active topup methods" ON public.topup_payment_methods;
CREATE POLICY "Authenticated users read active topup methods"
ON public.topup_payment_methods
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage topup methods" ON public.topup_payment_methods;
CREATE POLICY "Admins manage topup methods"
ON public.topup_payment_methods
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND lower(role) IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND lower(role) IN ('admin', 'owner')
    )
);
