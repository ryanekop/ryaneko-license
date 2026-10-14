-- Apply before deploying the once-per-license fallback notification helper.
-- Intentionally nullable: existing licenses may claim their first alert.
-- Device resets must preserve this lifetime claim, including failed sends.
ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS generic_fallback_alert_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.licenses.generic_fallback_alert_claimed_at IS
'Lifetime claim for one generic Windows fallback Telegram send attempt; preserve on device reset.';
