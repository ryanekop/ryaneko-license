ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS reset_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.licenses
ALTER COLUMN reset_count SET DEFAULT 0;

UPDATE public.licenses
SET reset_count = 0
WHERE reset_count IS NULL;

ALTER TABLE public.licenses
ALTER COLUMN reset_count SET NOT NULL;

ALTER TABLE public.licenses
DROP CONSTRAINT IF EXISTS licenses_reset_count_nonnegative;

ALTER TABLE public.licenses
ADD CONSTRAINT licenses_reset_count_nonnegative CHECK (reset_count >= 0);
