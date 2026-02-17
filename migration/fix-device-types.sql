-- Fix device_type: "macOS" → "Mac"
UPDATE public.licenses
SET device_type = 'Mac'
WHERE device_type = 'macOS';

-- Fix device_type: "macOS-Monterey" → "Mac (Monterey)"
UPDATE public.licenses
SET device_type = 'Mac (Monterey)'
WHERE device_type = 'macOS-Monterey';

-- Fix device_type: "macOS-Ventura" → "Mac (Ventura)"  
UPDATE public.licenses
SET device_type = 'Mac (Ventura)'
WHERE device_type = 'macOS-Ventura';

-- Fix device_type: "macOS-Sonoma" → "Mac (Sonoma)"
UPDATE public.licenses
SET device_type = 'Mac (Sonoma)'
WHERE device_type = 'macOS-Sonoma';

-- Fix device_type: "macOS-Sequoia" → "Mac (Sequoia)"
UPDATE public.licenses
SET device_type = 'Mac (Sequoia)'
WHERE device_type = 'macOS-Sequoia';

-- Catch-all: any remaining "macOS-*" patterns
UPDATE public.licenses
SET device_type = 'Mac (' || initcap(split_part(device_type, '-', 2)) || ')'
WHERE device_type LIKE 'macOS-%'
  AND device_type NOT IN ('Mac', 'Windows');

-- Verify results
SELECT device_type, COUNT(*) as count
FROM public.licenses
WHERE device_type IS NOT NULL
GROUP BY device_type
ORDER BY count DESC;
