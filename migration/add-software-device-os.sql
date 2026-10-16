-- Apply after add-software-store.sql, before deploying the per-device OS backend.
-- Existing orders retain their original OS information without inferred device records.
BEGIN;
ALTER TABLE public.software_orders ADD COLUMN IF NOT EXISTS device_os text[];

CREATE OR REPLACE FUNCTION public.begin_software_checkout(
    p_token_hash text, p_customer jsonb, p_count integer, p_amount integer, p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_order public.software_orders;
    v_attempt public.software_payment_attempts;
    v_product uuid;
    v_device_os text[];
BEGIN
    IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_count NOT BETWEEN 1 AND 3
        OR p_amount <> (CASE p_count WHEN 1 THEN 109000 WHEN 2 THEN 196000 WHEN 3 THEN 278000 END) THEN
        RAISE EXCEPTION 'Invalid checkout';
    END IF;
    IF p_customer ? 'deviceOs' THEN
        IF jsonb_typeof(p_customer->'deviceOs') IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Invalid device OS';
        END IF;
        IF jsonb_array_length(p_customer->'deviceOs') <> p_count
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_customer->'deviceOs') AS item(value)
                WHERE jsonb_typeof(value) <> 'string' OR length(btrim(value #>> '{}')) = 0)
            OR p_customer->'deviceOs'->>0 IS DISTINCT FROM p_customer->>'os' THEN
            RAISE EXCEPTION 'Invalid device OS';
        END IF;
        SELECT array_agg(value ORDER BY ordinal) INTO v_device_os
        FROM jsonb_array_elements_text(p_customer->'deviceOs') WITH ORDINALITY AS item(value, ordinal);
    ELSE
        v_device_os := array_fill(p_customer->>'os', ARRAY[p_count]);
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('store-token:' || p_token_hash, 0));
    SELECT * INTO v_order FROM software_orders WHERE access_token_hash = p_token_hash FOR UPDATE;
    IF FOUND THEN
        IF v_order.access_expires_at <= now() THEN RAISE EXCEPTION 'Checkout access expired'; END IF;
        IF v_order.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Checkout superseded'; END IF;
        IF v_order.license_count <> p_count OR v_order.amount <> p_amount
            OR v_order.customer_email <> p_customer->>'email' OR v_order.customer_name <> p_customer->>'name'
            OR v_order.customer_mobile <> p_customer->>'mobile' OR v_order.customer_instagram <> p_customer->>'instagram'
            OR v_order.os <> p_customer->>'os' OR v_order.source <> p_customer->>'source'
            OR coalesce(v_order.device_os, array_fill(v_order.os, ARRAY[v_order.license_count])) IS DISTINCT FROM v_device_os THEN
            RAISE EXCEPTION 'Checkout selection changed';
        END IF;
    ELSE
        SELECT id INTO v_product FROM products WHERE slug = 'raw-file-copy-tool';
        IF v_product IS NULL THEN RAISE EXCEPTION 'Product not configured'; END IF;
        INSERT INTO software_orders (product_id, access_token_hash, customer_name, customer_email,
            customer_mobile, customer_instagram, os, device_os, source, license_count, amount, expires_at)
        VALUES (v_product, p_token_hash, p_customer->>'name', p_customer->>'email', p_customer->>'mobile',
            p_customer->>'instagram', p_customer->>'os', CASE WHEN p_customer ? 'deviceOs' THEN v_device_os ELSE NULL END, p_customer->>'source', p_count, p_amount, p_expires_at)
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

CREATE OR REPLACE FUNCTION public.software_purchase_history(p_email text, p_page integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_orders jsonb; v_more boolean;
BEGIN
    IF p_page < 1 OR p_page > 10000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
    WITH all_orders AS (
        SELECT o.id, 'checkout' AS kind, o.created_at, o.license_count, o.amount, o.status, o.os, o.device_os, true AS payment_known
        FROM software_orders o JOIN products pr ON pr.id = o.product_id
        WHERE o.customer_email = lower(p_email) AND pr.slug = 'raw-file-copy-tool'
        UNION ALL
        SELECT p.id, 'legacy', p.created_at, p.license_count,
            CASE WHEN coalesce(p.raw_payload #>> '{data,amount}', p.raw_payload->>'amount') ~ '^\d{1,9}$'
                THEN coalesce(p.raw_payload #>> '{data,amount}', p.raw_payload->>'amount')::integer ELSE NULL END,
            CASE WHEN lower(coalesce(p.raw_payload #>> '{data,status}', p.raw_payload->>'status', '')) = 'paid'
                THEN 'fulfilled' ELSE 'verifying' END,
            NULL::text, NULL::text[],
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
        'count', license_count, 'amount', amount, 'status', status, 'os', os, 'deviceOs', device_os,
        'serials', '[]'::jsonb, 'downloads', '[]'::jsonb, 'paymentStatusKnown', payment_known
    ) ORDER BY created_at DESC, id DESC) FILTER (WHERE n <= 20), '[]'::jsonb), coalesce(bool_or(n > 20), false)
    INTO v_orders, v_more FROM numbered;
    RETURN jsonb_build_object('orders', v_orders, 'hasMore', v_more, 'page', p_page);
END $$;

-- CREATE OR REPLACE preserves existing ownership and grants.
REVOKE ALL ON FUNCTION public.begin_software_checkout(text,jsonb,integer,integer,timestamptz),
    public.software_purchase_history(text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_software_checkout(text,jsonb,integer,integer,timestamptz),
    public.software_purchase_history(text,integer) TO service_role;
COMMIT;
