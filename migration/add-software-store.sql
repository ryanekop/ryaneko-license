-- Apply to Ryan Eko License Supabase before enabling SOFTWARE_STORE_ENABLED.
-- New tables and SECURITY DEFINER RPCs are intentionally service-role only.
BEGIN;

-- Existing purchases are assumed delivered; new allocations are explicitly pending.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS license_email_status text NOT NULL DEFAULT 'sent';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS license_email_claimed_at timestamptz;
-- The original schema's broadly scoped RLS policy must not allow browser clients
-- to bypass OTP and read licenses/purchases directly. App APIs use service_role.
REVOKE ALL ON public.licenses, public.purchases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.licenses, public.purchases TO service_role;

CREATE TABLE IF NOT EXISTS public.software_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id),
    access_token_hash text NOT NULL UNIQUE,
    email_access_token_hash text,
    access_expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_mobile text NOT NULL,
    customer_instagram text NOT NULL,
    os text NOT NULL,
    source text NOT NULL,
    license_count integer NOT NULL CHECK (license_count BETWEEN 1 AND 3),
    amount integer NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'fulfilled', 'expired', 'awaiting_stock', 'payment_error')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    fulfilled_at timestamptz,
    superseded_at timestamptz,
    duplicate_payment_notified_at timestamptz,
    email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sending', 'sent', 'failed')),
    email_claimed_at timestamptz,
    last_verified_at timestamptz
);
CREATE INDEX IF NOT EXISTS software_orders_email_created ON public.software_orders (customer_email, created_at DESC);
CREATE INDEX IF NOT EXISTS purchases_lower_email_created ON public.purchases (lower(customer_email), product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.software_payment_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.software_orders(id),
    status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'pending', 'uncertain', 'paid', 'expired', 'failed')),
    payment_id text UNIQUE,
    transaction_id text UNIQUE,
    checkout_url text,
    redirect_url_hash text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS software_attempt_order_created ON public.software_payment_attempts (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.software_otp_challenges (
    email text PRIMARY KEY,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.software_otp_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL,
    ip_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS software_otp_email_time ON public.software_otp_requests (email, created_at);
CREATE INDEX IF NOT EXISTS software_otp_ip_time ON public.software_otp_requests (ip_hash, created_at);
CREATE TABLE IF NOT EXISTS public.software_history_sessions (
    token_hash text PRIMARY KEY,
    email text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.software_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_otp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_history_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.software_orders, public.software_payment_attempts,
    public.software_otp_challenges, public.software_otp_requests, public.software_history_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.software_orders, public.software_payment_attempts,
    public.software_otp_challenges, public.software_otp_requests, public.software_history_sessions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.software_otp_requests_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.begin_software_checkout(
    p_token_hash text, p_customer jsonb, p_count integer, p_amount integer, p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_order public.software_orders;
    v_attempt public.software_payment_attempts;
    v_product uuid;
BEGIN
    IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_count NOT BETWEEN 1 AND 3
        OR p_amount <> (CASE p_count WHEN 1 THEN 109000 WHEN 2 THEN 196000 WHEN 3 THEN 278000 END) THEN
        RAISE EXCEPTION 'Invalid checkout';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('store-token:' || p_token_hash, 0));
    SELECT * INTO v_order FROM software_orders WHERE access_token_hash = p_token_hash FOR UPDATE;
    IF FOUND THEN
        IF v_order.access_expires_at <= now() THEN RAISE EXCEPTION 'Checkout access expired'; END IF;
        IF v_order.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Checkout superseded'; END IF;
        IF v_order.license_count <> p_count OR v_order.amount <> p_amount
            OR v_order.customer_email <> p_customer->>'email' OR v_order.customer_name <> p_customer->>'name'
            OR v_order.customer_mobile <> p_customer->>'mobile' OR v_order.customer_instagram <> p_customer->>'instagram'
            OR v_order.os <> p_customer->>'os' OR v_order.source <> p_customer->>'source' THEN
            RAISE EXCEPTION 'Checkout selection changed';
        END IF;
    ELSE
        SELECT id INTO v_product FROM products WHERE slug = 'raw-file-copy-tool';
        IF v_product IS NULL THEN RAISE EXCEPTION 'Product not configured'; END IF;
        INSERT INTO software_orders (product_id, access_token_hash, customer_name, customer_email,
            customer_mobile, customer_instagram, os, source, license_count, amount, expires_at)
        VALUES (v_product, p_token_hash, p_customer->>'name', p_customer->>'email', p_customer->>'mobile',
            p_customer->>'instagram', p_customer->>'os', p_customer->>'source', p_count, p_amount, p_expires_at)
        RETURNING * INTO v_order;
    END IF;
    SELECT * INTO v_attempt FROM software_payment_attempts WHERE order_id = v_order.id ORDER BY created_at DESC, id DESC LIMIT 1;
    -- Never turn an ambiguous provider timeout into another chargeable payment.
    IF v_order.status IN ('fulfilled', 'awaiting_stock') OR v_attempt.status IN ('creating', 'uncertain', 'pending', 'paid') THEN
        RETURN jsonb_build_object('order', to_jsonb(v_order), 'attempt', CASE WHEN v_attempt.id IS NULL THEN NULL ELSE to_jsonb(v_attempt) END, 'created', false);
    END IF;
    INSERT INTO software_payment_attempts (order_id, expires_at) VALUES (v_order.id, p_expires_at) RETURNING * INTO v_attempt;
    UPDATE software_orders SET status = 'pending', expires_at = p_expires_at WHERE id = v_order.id RETURNING * INTO v_order;
    RETURN jsonb_build_object('order', to_jsonb(v_order), 'attempt', to_jsonb(v_attempt), 'created', true);
END $$;

-- Shared allocation guard for new checkout and the old software webhook.
CREATE OR REPLACE FUNCTION public.fulfill_legacy_software_purchase(
    p_product_id uuid, p_order_id text, p_count integer, p_name text, p_email text,
    p_instagram text, p_includes_plugin boolean, p_addons jsonb, p_raw_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_purchase public.purchases;
    v_ids uuid[];
    v_existing uuid[];
    v_licenses jsonb;
BEGIN
    IF p_count < 1 OR p_count > 50 OR nullif(p_order_id, '') IS NULL THEN RAISE EXCEPTION 'Invalid purchase'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('software-purchase:' || p_order_id, 0));
    SELECT * INTO v_purchase FROM purchases WHERE order_id = p_order_id FOR UPDATE;
    IF FOUND THEN
        IF v_purchase.product_id <> p_product_id OR lower(v_purchase.customer_email) <> lower(p_email) THEN
            RAISE EXCEPTION 'Purchase identity mismatch';
        END IF;
        SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.created_at, l.id), '[]'::jsonb) INTO v_licenses
            FROM licenses l WHERE l.id = ANY(v_purchase.licenses_assigned) AND l.order_id = p_order_id;
        RETURN jsonb_build_object('licenses', v_licenses, 'newly_fulfilled', false);
    END IF;
    -- Recover assignments made by the pre-migration webhook before a failed purchase insert.
    SELECT array_agg(id ORDER BY created_at, id) INTO v_existing FROM licenses
        WHERE product_id = p_product_id AND order_id = p_order_id AND lower(customer_email) = lower(p_email);
    IF coalesce(cardinality(v_existing), 0) > p_count THEN RAISE EXCEPTION 'Legacy assignment requires review'; END IF;
    SELECT array_agg(id) INTO v_ids FROM (
        SELECT id FROM licenses WHERE product_id = p_product_id AND status = 'available'
            AND customer_name IS NULL AND customer_email IS NULL AND order_id IS NULL
        ORDER BY created_at, id LIMIT p_count - coalesce(cardinality(v_existing), 0) FOR UPDATE SKIP LOCKED
    ) available;
    v_ids := coalesce(v_existing, '{}'::uuid[]) || coalesce(v_ids, '{}'::uuid[]);
    IF cardinality(v_ids) < p_count THEN
        RETURN jsonb_build_object('licenses', '[]'::jsonb, 'newly_fulfilled', false);
    END IF;
    UPDATE licenses SET customer_name = p_name, customer_email = p_email, customer_instagram = p_instagram,
        order_id = p_order_id, batch_info = CASE WHEN p_count > 1 THEN 'Batch ' || array_position(v_ids, id) || '/' || p_count ELSE NULL END,
        updated_at = now() WHERE id = ANY(v_ids);
    INSERT INTO purchases (order_id, product_id, customer_name, customer_email, customer_instagram,
        license_count, includes_plugin, addons, raw_payload, licenses_assigned, license_email_status)
    VALUES (p_order_id, p_product_id, p_name, p_email, p_instagram, p_count, p_includes_plugin, p_addons, p_raw_payload, v_ids, 'pending');
    SELECT jsonb_agg(to_jsonb(l) ORDER BY array_position(v_ids, l.id)) INTO v_licenses FROM licenses l WHERE l.id = ANY(v_ids);
    RETURN jsonb_build_object('licenses', v_licenses, 'newly_fulfilled', true);
END $$;

CREATE OR REPLACE FUNCTION public.claim_legacy_software_email(p_order_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE purchases SET license_email_status = 'sending', license_email_claimed_at = now()
    WHERE order_id = p_order_id AND (license_email_status IN ('pending', 'failed')
        OR (license_email_status = 'sending' AND license_email_claimed_at < now() - interval '5 minutes'));
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.claim_software_verification(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE software_orders SET last_verified_at = now() WHERE id = p_order_id
        AND (last_verified_at IS NULL OR last_verified_at < now() - interval '10 seconds');
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.fulfill_software_order(
    p_order_id uuid, p_attempt_id uuid, p_transaction_id text, p_amount integer, p_email text, p_raw_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_order public.software_orders;
    v_attempt public.software_payment_attempts;
    v_result jsonb;
BEGIN
    SELECT * INTO v_order FROM software_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    SELECT * INTO v_attempt FROM software_payment_attempts WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
    IF NOT FOUND OR p_amount <> v_order.amount OR lower(p_email) <> v_order.customer_email
        OR (v_attempt.transaction_id IS NOT NULL AND v_attempt.transaction_id <> p_transaction_id) THEN
        RAISE EXCEPTION 'Payment mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM software_payment_attempts WHERE order_id = p_order_id AND status = 'paid' AND id <> p_attempt_id) THEN
        RAISE EXCEPTION 'Order already paid through another attempt';
    END IF;
    IF v_order.status = 'fulfilled' THEN
        -- A late payment from an older attempt must not cause a second allocation.
        IF v_attempt.status <> 'paid' THEN RAISE EXCEPTION 'Order already paid through another attempt'; END IF;
        RETURN jsonb_build_object('order', to_jsonb(v_order), 'newly_fulfilled', false);
    END IF;
    UPDATE software_payment_attempts SET transaction_id = p_transaction_id, status = 'paid', updated_at = now() WHERE id = p_attempt_id;
    v_result := fulfill_legacy_software_purchase(v_order.product_id, p_transaction_id, v_order.license_count,
        v_order.customer_name, v_order.customer_email, v_order.customer_instagram, false,
        jsonb_build_object('package_count', v_order.license_count), p_raw_payload);
    UPDATE software_orders SET
        status = CASE WHEN jsonb_array_length(v_result->'licenses') = license_count THEN 'fulfilled' ELSE 'awaiting_stock' END,
        fulfilled_at = CASE WHEN jsonb_array_length(v_result->'licenses') = license_count THEN now() ELSE NULL END
        WHERE id = p_order_id RETURNING * INTO v_order;
    RETURN jsonb_build_object('order', to_jsonb(v_order), 'newly_fulfilled', v_result->'newly_fulfilled');
END $$;

CREATE OR REPLACE FUNCTION public.claim_software_email(p_order_id uuid, p_email_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE software_orders SET email_status = 'sending', email_claimed_at = now(), email_access_token_hash = p_email_token_hash
    WHERE id = p_order_id AND status = 'fulfilled' AND (email_status = 'pending'
        OR (email_status = 'failed' AND email_claimed_at < now() - interval '60 seconds')
        OR (email_status = 'sending' AND email_claimed_at < now() - interval '5 minutes'));
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.begin_software_otp(p_email text, p_ip_hash text, p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    -- Consistent lock order across requests prevents resend races across workers.
    PERFORM pg_advisory_xact_lock(hashtextextended('store-otp-ip:' || p_ip_hash, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('store-otp-email:' || p_email, 0));
    DELETE FROM software_otp_requests WHERE created_at < now() - interval '1 day';
    DELETE FROM software_history_sessions WHERE expires_at < now();
    DELETE FROM software_otp_challenges WHERE expires_at < now() - interval '1 day';
    IF EXISTS (SELECT 1 FROM software_otp_requests WHERE email = p_email AND created_at > now() - interval '60 seconds')
        OR (SELECT count(*) FROM software_otp_requests WHERE email = p_email AND created_at > now() - interval '1 hour') >= 5
        OR (SELECT count(*) FROM software_otp_requests WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour') >= 20 THEN
        RETURN jsonb_build_object('allowed', false, 'cooldown_seconds', 60);
    END IF;
    INSERT INTO software_otp_requests (email, ip_hash) VALUES (p_email, p_ip_hash);
    INSERT INTO software_otp_challenges (email, code_hash, expires_at) VALUES (p_email, p_code_hash, now() + interval '10 minutes')
    ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
        attempts = 0, consumed_at = NULL, created_at = now();
    RETURN jsonb_build_object('allowed', true, 'cooldown_seconds', 60);
END $$;

CREATE OR REPLACE FUNCTION public.verify_software_otp(p_email text, p_code_hash text, p_session_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_challenge public.software_otp_challenges; v_expiry timestamptz := now() + interval '30 minutes';
BEGIN
    SELECT * INTO v_challenge FROM software_otp_challenges WHERE email = p_email FOR UPDATE;
    IF NOT FOUND OR v_challenge.expires_at <= now() OR v_challenge.consumed_at IS NOT NULL OR v_challenge.attempts >= 5 THEN
        RETURN jsonb_build_object('verified', false);
    END IF;
    UPDATE software_otp_challenges SET attempts = attempts + 1 WHERE email = p_email;
    IF v_challenge.code_hash <> p_code_hash THEN RETURN jsonb_build_object('verified', false); END IF;
    UPDATE software_otp_challenges SET consumed_at = now() WHERE email = p_email;
    INSERT INTO software_history_sessions (token_hash, email, expires_at) VALUES (p_session_hash, p_email, v_expiry);
    RETURN jsonb_build_object('verified', true, 'expires_at', v_expiry);
END $$;

CREATE OR REPLACE FUNCTION public.software_purchase_history(p_email text, p_page integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_orders jsonb; v_more boolean;
BEGIN
    IF p_page < 1 OR p_page > 10000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
    WITH all_orders AS (
        SELECT o.id, 'checkout' AS kind, o.created_at, o.license_count, o.amount, o.status, o.os, true AS payment_known
        FROM software_orders o JOIN products pr ON pr.id = o.product_id
        WHERE o.customer_email = lower(p_email) AND pr.slug = 'raw-file-copy-tool'
        UNION ALL
        SELECT p.id, 'legacy', p.created_at, p.license_count,
            CASE WHEN coalesce(p.raw_payload #>> '{data,amount}', p.raw_payload->>'amount') ~ '^\d{1,9}$'
                THEN coalesce(p.raw_payload #>> '{data,amount}', p.raw_payload->>'amount')::integer ELSE NULL END,
            CASE WHEN lower(coalesce(p.raw_payload #>> '{data,status}', p.raw_payload->>'status', '')) = 'paid'
                THEN 'fulfilled' ELSE 'verifying' END,
            NULL::text,
            lower(coalesce(p.raw_payload #>> '{data,status}', p.raw_payload->>'status', '')) = 'paid'
        FROM purchases p JOIN products pr ON pr.id = p.product_id
        WHERE lower(p.customer_email) = lower(p_email) AND pr.slug = 'raw-file-copy-tool'
            AND NOT EXISTS (SELECT 1 FROM software_payment_attempts a WHERE a.transaction_id = p.order_id)
    ), page_rows AS (
        SELECT * FROM all_orders ORDER BY created_at DESC, id DESC OFFSET (p_page - 1) * 20 LIMIT 21
    ), numbered AS (
        SELECT *, row_number() OVER (ORDER BY created_at DESC, id DESC) AS n FROM page_rows
    ) SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'productName', 'RAW File Copy Tool', 'createdAt', created_at,
        'count', license_count, 'amount', amount, 'status', status, 'os', os,
        'serials', '[]'::jsonb, 'downloads', '[]'::jsonb, 'paymentStatusKnown', payment_known
    ) ORDER BY created_at DESC, id DESC) FILTER (WHERE n <= 20), '[]'::jsonb), coalesce(bool_or(n > 20), false)
    INTO v_orders, v_more FROM numbered;
    RETURN jsonb_build_object('orders', v_orders, 'hasMore', v_more, 'page', p_page);
END $$;

REVOKE ALL ON FUNCTION public.begin_software_checkout(text,jsonb,integer,integer,timestamptz),
    public.fulfill_legacy_software_purchase(uuid,text,integer,text,text,text,boolean,jsonb,jsonb),
    public.claim_software_verification(uuid), public.fulfill_software_order(uuid,uuid,text,integer,text,jsonb),
    public.claim_software_email(uuid,text), public.begin_software_otp(text,text,text), public.verify_software_otp(text,text,text)
    , public.claim_legacy_software_email(text), public.software_purchase_history(text,integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_software_checkout(text,jsonb,integer,integer,timestamptz),
    public.fulfill_legacy_software_purchase(uuid,text,integer,text,text,text,boolean,jsonb,jsonb),
    public.claim_software_verification(uuid), public.fulfill_software_order(uuid,uuid,text,integer,text,jsonb),
    public.claim_software_email(uuid,text), public.begin_software_otp(text,text,text), public.verify_software_otp(text,text,text)
    , public.claim_legacy_software_email(text), public.software_purchase_history(text,integer)
    TO service_role;
COMMIT;
