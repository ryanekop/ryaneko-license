-- Apply to the Ryan Eko License Supabase project.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS licenses_serial_key_trgm_idx ON public.licenses USING gin (serial_key gin_trgm_ops);
CREATE INDEX IF NOT EXISTS licenses_customer_name_trgm_idx ON public.licenses USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS licenses_customer_email_trgm_idx ON public.licenses USING gin (customer_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS licenses_product_updated_idx ON public.licenses (product_id, updated_at DESC, id);

CREATE OR REPLACE FUNCTION public.admin_list_licenses(
  p_product_slug text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_query text DEFAULT '',
  p_status text DEFAULT 'all',
  p_device text DEFAULT 'all',
  p_data_filter text DEFAULT 'all',
  p_sort text DEFAULT 'desc'
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH base AS (
    SELECT l.*, to_jsonb(p) AS product
    FROM public.licenses l
    JOIN public.products p ON p.id = l.product_id
    WHERE p.slug = p_product_slug
  ), filtered AS (
    SELECT * FROM base
    WHERE (coalesce(btrim(p_query), '') = '' OR
      customer_name ILIKE '%' || p_query || '%' OR customer_email ILIKE '%' || p_query || '%' OR
      customer_instagram ILIKE '%' || p_query || '%' OR serial_key ILIKE '%' || p_query || '%')
      AND (p_status = 'all' OR status = p_status)
      AND (p_device = 'all' OR device_type ILIKE p_device || '%')
      AND (
        p_data_filter = 'all'
        OR (p_data_filter = 'with-data' AND (status <> 'available' OR customer_name IS NOT NULL OR customer_email IS NOT NULL OR device_type IS NOT NULL))
        OR (p_data_filter = 'empty' AND status = 'available' AND customer_name IS NULL AND customer_email IS NULL AND device_type IS NULL)
      )
  ), page_rows AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_sort = 'asc' THEN updated_at END ASC,
      CASE WHEN p_sort <> 'asc' THEN updated_at END DESC,
      CASE WHEN p_sort = 'asc' THEN id END ASC,
      CASE WHEN p_sort <> 'asc' THEN id END DESC
    LIMIT greatest(1, least(p_page_size, 100))
    OFFSET (least(greatest(1, p_page), greatest(1, ceil((SELECT count(*) FROM filtered)::numeric / greatest(1, least(p_page_size, 100)))::integer)) - 1) * greatest(1, least(p_page_size, 100))
  ), totals AS (
    SELECT count(*)::integer AS total FROM filtered
  ), facets AS (
    SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE status = 'available')::integer AS available,
      count(*) FILTER (WHERE status = 'used')::integer AS used
    FROM base
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(page_rows) - 'product' || jsonb_build_object('product', product)) FROM page_rows), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', least(greatest(1, p_page), greatest(1, ceil((SELECT total FROM totals)::numeric / greatest(1, least(p_page_size, 100)))::integer)), 'pageSize', greatest(1, least(p_page_size, 100)),
      'total', (SELECT total FROM totals),
      'totalPages', greatest(1, ceil((SELECT total FROM totals)::numeric / greatest(1, least(p_page_size, 100)))::integer)
    ),
    'facets', (SELECT to_jsonb(facets) FROM facets)
  );
$function$;

REVOKE ALL ON FUNCTION public.admin_list_licenses(text, integer, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_licenses(text, integer, integer, text, text, text, text, text) TO service_role;
