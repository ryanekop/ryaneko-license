-- Apply to the Fastpik Supabase project.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS fastpik_profiles_full_name_trgm_idx ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS fastpik_tenants_name_trgm_idx ON public.tenants USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.admin_list_fastpik_users(
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_query text DEFAULT '',
  p_tier text DEFAULT 'all', p_expiry text DEFAULT 'all', p_sort text DEFAULT 'newest'
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $function$
  WITH owners AS (
    SELECT u.id, coalesce(u.email, 'No Email') AS email,
      coalesce(pr.full_name, u.raw_user_meta_data->>'full_name', 'No Name') AS name,
      st.vendor_name AS "vendorName", st.tenant_id AS "tenantId", t.name AS "tenantName", t.domain AS "tenantDomain",
      u.created_at AS "createdAt",
      greatest(u.created_at, coalesce(u.email_confirmed_at, u.created_at), coalesce(s.start_date, u.created_at)) AS "registeredSortAt",
      coalesce(s.tier::text, 'none') AS tier, coalesce(s.status::text, 'inactive') AS status,
      coalesce(s.end_date, s.trial_end_date) AS "expiresAt", u.last_sign_in_at AS "lastSignIn",
      (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed"
    FROM auth.users u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    LEFT JOIN public.settings st ON st.user_id = u.id
    LEFT JOIN public.tenants t ON t.id = st.tenant_id
  ), filtered AS (
    SELECT * FROM owners
    WHERE (coalesce(btrim(p_query), '') = '' OR name ILIKE '%'||p_query||'%' OR email ILIKE '%'||p_query||'%')
      AND (p_tier = 'all' OR (p_tier = 'trial' AND (tier = 'free' OR status = 'trial')) OR tier = p_tier)
      AND (p_expiry = 'all' OR (p_expiry = 'expired' AND tier <> 'lifetime' AND "expiresAt" < now()) OR
        (p_expiry = 'active' AND NOT (tier <> 'lifetime' AND "expiresAt" IS NOT NULL AND "expiresAt" < now())))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY
      CASE WHEN p_sort = 'oldest' THEN "registeredSortAt" END ASC,
      CASE WHEN p_sort = 'newest' THEN "registeredSortAt" END DESC,
      CASE WHEN p_sort = 'expiresSoon' THEN "expiresAt" END ASC NULLS LAST,
      CASE WHEN p_sort = 'expiresLatest' THEN "expiresAt" END DESC NULLS LAST, id
    LIMIT greatest(1, least(p_page_size,100)) OFFSET (least(greatest(1,p_page),greatest(1,ceil((SELECT count(*) FROM filtered)::numeric/greatest(1,least(p_page_size,100)))::integer))-1)*greatest(1,least(p_page_size,100))
  ), counts AS (SELECT count(*)::integer total FROM filtered)
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),'[]'::jsonb),
    'pagination', jsonb_build_object('page',least(greatest(1,p_page),greatest(1,ceil((SELECT total FROM counts)::numeric/greatest(1,least(p_page_size,100)))::integer)),'pageSize',greatest(1,least(p_page_size,100)),'total',(SELECT total FROM counts),'totalPages',greatest(1,ceil((SELECT total FROM counts)::numeric/greatest(1,least(p_page_size,100)))::integer)),
    'facets', jsonb_build_object('total',(SELECT count(*) FROM owners),'tiers',(SELECT coalesce(jsonb_object_agg(k,c),'{}'::jsonb) FROM (SELECT CASE WHEN tier='free' OR status='trial' THEN 'trial' ELSE tier END k,count(*) c FROM owners GROUP BY 1)x),'expiry',jsonb_build_object('expired',(SELECT count(*) FROM owners WHERE tier<>'lifetime' AND "expiresAt"<now()),'active',(SELECT count(*) FROM owners WHERE NOT(tier<>'lifetime' AND "expiresAt" IS NOT NULL AND "expiresAt"<now()))))
  );
$function$;
REVOKE ALL ON FUNCTION public.admin_list_fastpik_users(integer,integer,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_fastpik_users(integer,integer,text,text,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
