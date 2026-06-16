-- Run this migration in the Client Desk Supabase project.

ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'scheduled';

CREATE TABLE IF NOT EXISTS public.subscription_plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID,
  history_id UUID,
  tier public.subscription_tier NOT NULL,
  plan public.subscription_plan NOT NULL,
  duration public.subscription_duration NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'applied', 'cancelled')),
  effective_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  transaction_id TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > effective_at)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_changes_due
  ON public.subscription_plan_changes (status, effective_at);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_changes_user_tail
  ON public.subscription_plan_changes (user_id, status, end_at DESC);

ALTER TABLE public.subscription_plan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.subscription_plan_changes;
CREATE POLICY "Service role full access"
  ON public.subscription_plan_changes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.shift_scheduled_subscription_plan_changes(
  p_user_id UUID,
  p_shift_ms BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_shift_ms = 0 THEN
    RETURN;
  END IF;

  UPDATE public.subscription_plan_changes
  SET
    effective_at = effective_at + (p_shift_ms * interval '1 millisecond'),
    end_at = end_at + (p_shift_ms * interval '1 millisecond'),
    updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'scheduled';

  UPDATE public.subscription_history
  SET
    period_start = period_start + (p_shift_ms * interval '1 millisecond'),
    period_end = period_end + (p_shift_ms * interval '1 millisecond'),
    metadata = jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{billing,entitlementStartsAt}',
        to_jsonb((period_start + (p_shift_ms * interval '1 millisecond'))::text),
        true
      ),
      '{billing,entitlementEndsAt}',
      to_jsonb((period_end + (p_shift_ms * interval '1 millisecond'))::text),
      true
    )
  WHERE id IN (
    SELECT history_id
    FROM public.subscription_plan_changes
    WHERE user_id = p_user_id
      AND status = 'scheduled'
      AND history_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_clientdesk_subscription_purchase(
  p_user_id UUID,
  p_tier public.subscription_tier,
  p_plan public.subscription_plan,
  p_duration public.subscription_duration,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_amount NUMERIC,
  p_transaction_id TEXT,
  p_event_type public.subscription_history_event_type,
  p_queue_shift_ms BIGINT,
  p_expected_tier public.subscription_tier,
  p_expected_end_date TIMESTAMPTZ,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_current_tier public.subscription_tier;
  v_current_end_date TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id, tier, end_date
  INTO v_subscription_id, v_current_tier, v_current_end_date
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.subscription_history
    WHERE transaction_id = p_transaction_id
  ) THEN
    RETURN;
  END IF;

  IF v_current_tier IS DISTINCT FROM p_expected_tier
    OR v_current_end_date IS DISTINCT FROM p_expected_end_date THEN
    RAISE EXCEPTION 'subscription changed concurrently';
  END IF;

  PERFORM public.shift_scheduled_subscription_plan_changes(p_user_id, p_queue_shift_ms);

  INSERT INTO public.subscriptions (
    user_id,
    tier,
    plan,
    duration,
    status,
    start_date,
    end_date,
    trial_end_date,
    mayar_transaction_id,
    updated_at
  )
  VALUES (
    p_user_id,
    p_tier,
    p_plan,
    p_duration,
    'active',
    p_start_date,
    p_end_date,
    NULL,
    p_transaction_id,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    tier = EXCLUDED.tier,
    plan = EXCLUDED.plan,
    duration = EXCLUDED.duration,
    status = 'active',
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    trial_end_date = NULL,
    mayar_transaction_id = EXCLUDED.mayar_transaction_id,
    updated_at = now()
  RETURNING id INTO v_subscription_id;

  INSERT INTO public.subscription_history (
    user_id,
    subscription_id,
    event_type,
    tier,
    plan,
    duration,
    status,
    period_start,
    period_end,
    amount,
    currency,
    transaction_id,
    metadata
  )
  VALUES (
    p_user_id,
    v_subscription_id,
    p_event_type,
    p_tier,
    p_plan,
    p_duration,
    'active',
    p_start_date,
    p_end_date,
    p_amount,
    'IDR',
    p_transaction_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_clientdesk_subscription_change(
  p_user_id UUID,
  p_tier public.subscription_tier,
  p_plan public.subscription_plan,
  p_duration public.subscription_duration,
  p_effective_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_amount NUMERIC,
  p_transaction_id TEXT,
  p_expected_tier public.subscription_tier,
  p_expected_end_date TIMESTAMPTZ,
  p_metadata JSONB
)
RETURNS TABLE (
  scheduled_effective_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_history_id UUID;
  v_current_tier public.subscription_tier;
  v_current_end_date TIMESTAMPTZ;
  v_queue_tail TIMESTAMPTZ;
  v_effective_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_duration INTERVAL;
  v_metadata JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id, tier, end_date
  INTO v_subscription_id, v_current_tier, v_current_end_date
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.subscription_history
    WHERE transaction_id = p_transaction_id
  ) OR EXISTS (
    SELECT 1 FROM public.subscription_plan_changes
    WHERE transaction_id = p_transaction_id
  ) THEN
    SELECT effective_at, end_at
    INTO scheduled_effective_at, scheduled_end_at
    FROM public.subscription_plan_changes
    WHERE transaction_id = p_transaction_id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_current_tier IS DISTINCT FROM p_expected_tier
    OR v_current_end_date IS DISTINCT FROM p_expected_end_date THEN
    RAISE EXCEPTION 'subscription changed concurrently';
  END IF;

  SELECT max(end_at)
  INTO v_queue_tail
  FROM public.subscription_plan_changes
  WHERE user_id = p_user_id
    AND status = 'scheduled';

  v_duration := p_end_at - p_effective_at;
  v_effective_at := GREATEST(
    p_effective_at,
    COALESCE(v_current_end_date, p_effective_at),
    COALESCE(v_queue_tail, p_effective_at)
  );
  v_end_at := v_effective_at + v_duration;
  v_metadata := jsonb_set(
    jsonb_set(
      COALESCE(p_metadata, '{}'::jsonb),
      '{billing,entitlementStartsAt}',
      to_jsonb(v_effective_at::text),
      true
    ),
    '{billing,entitlementEndsAt}',
    to_jsonb(v_end_at::text),
    true
  );

  INSERT INTO public.subscription_history (
    user_id,
    subscription_id,
    event_type,
    tier,
    plan,
    duration,
    status,
    period_start,
    period_end,
    amount,
    currency,
    transaction_id,
    metadata
  )
  VALUES (
    p_user_id,
    v_subscription_id,
    'changed',
    p_tier,
    p_plan,
    p_duration,
    'scheduled',
    v_effective_at,
    v_end_at,
    p_amount,
    'IDR',
    p_transaction_id,
    v_metadata
  )
  RETURNING id INTO v_history_id;

  INSERT INTO public.subscription_plan_changes (
    user_id,
    subscription_id,
    history_id,
    tier,
    plan,
    duration,
    effective_at,
    end_at,
    amount,
    transaction_id,
    metadata
  )
  VALUES (
    p_user_id,
    v_subscription_id,
    v_history_id,
    p_tier,
    p_plan,
    p_duration,
    v_effective_at,
    v_end_at,
    p_amount,
    p_transaction_id,
    v_metadata
  );

  scheduled_effective_at := v_effective_at;
  scheduled_end_at := v_end_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_due_subscription_plan_changes()
RETURNS TABLE (
  change_id UUID,
  changed_user_id UUID,
  changed_tier TEXT,
  changed_end_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_change public.subscription_plan_changes%ROWTYPE;
BEGIN
  FOR v_change IN
    SELECT *
    FROM public.subscription_plan_changes
    WHERE status = 'scheduled'
      AND effective_at <= now()
    ORDER BY effective_at, created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_change.user_id::text, 0));

    UPDATE public.subscriptions
    SET
      tier = v_change.tier,
      plan = v_change.plan,
      duration = v_change.duration,
      status = 'active',
      start_date = v_change.effective_at,
      end_date = v_change.end_at,
      trial_end_date = NULL,
      mayar_transaction_id = v_change.transaction_id,
      updated_at = now()
    WHERE user_id = v_change.user_id;

    UPDATE public.subscription_history
    SET status = 'active'
    WHERE id = v_change.history_id;

    UPDATE public.subscription_plan_changes
    SET
      status = 'applied',
      applied_at = now(),
      updated_at = now()
    WHERE id = v_change.id;

    change_id := v_change.id;
    changed_user_id := v_change.user_id;
    changed_tier := v_change.tier;
    changed_end_at := v_change.end_at;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.shift_scheduled_subscription_plan_changes(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_clientdesk_subscription_purchase(UUID, public.subscription_tier, public.subscription_plan, public.subscription_duration, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, public.subscription_history_event_type, BIGINT, public.subscription_tier, TIMESTAMPTZ, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_clientdesk_subscription_change(UUID, public.subscription_tier, public.subscription_plan, public.subscription_duration, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, public.subscription_tier, TIMESTAMPTZ, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_due_subscription_plan_changes() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.shift_scheduled_subscription_plan_changes(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_clientdesk_subscription_purchase(UUID, public.subscription_tier, public.subscription_plan, public.subscription_duration, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, public.subscription_history_event_type, BIGINT, public.subscription_tier, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_clientdesk_subscription_change(UUID, public.subscription_tier, public.subscription_plan, public.subscription_duration, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, public.subscription_tier, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_due_subscription_plan_changes() TO service_role;
