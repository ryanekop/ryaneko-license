ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.licenses
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.licenses
ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.licenses
ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_updated_at
ON public.licenses(updated_at DESC);
