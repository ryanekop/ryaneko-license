-- Apply to the ClientDesk Supabase project.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS clientdesk_profiles_full_name_trgm_idx ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clientdesk_tenants_name_trgm_idx ON public.tenants USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.admin_list_clientdesk_users(
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_query text DEFAULT '',
  p_package text DEFAULT 'all', p_duration text DEFAULT 'all', p_expiry text DEFAULT 'all', p_sort text DEFAULT 'newest'
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $function$
  WITH member_ids AS (SELECT member_user_id FROM public.workspace_memberships WHERE status IN ('invited','active','disabled') AND member_user_id IS NOT NULL AND member_user_id <> owner_user_id),
  owners AS (
    SELECT u.id, coalesce(u.email,'No Email') email, coalesce(pr.full_name,u.raw_user_meta_data->>'full_name','No Name') name,
      pr.role, pr.vendor_slug AS "vendorSlug", pr.tenant_id AS "tenantId", t.name AS "tenantName",
      u.created_at AS "createdAt", greatest(u.created_at,coalesce(u.email_confirmed_at,u.created_at),coalesce(s.start_date,u.created_at)) AS "registeredSortAt",
      CASE WHEN s.plan::text IN ('basic','plus','pro') AND s.duration::text IN ('monthly','quarterly','yearly','lifetime') THEN s.plan::text||'_'||s.duration::text ELSE coalesce(s.tier::text,'none') END tier,
      coalesce(s.status::text,'inactive') status,
      CASE WHEN s.plan::text IN ('basic','plus','pro') THEN s.plan::text WHEN split_part(s.tier::text,'_',1) IN ('basic','plus','pro') THEN split_part(s.tier::text,'_',1) WHEN s.tier::text='lifetime' THEN 'basic' ELSE CASE WHEN s.tier::text='free' OR s.status::text='trial' THEN 'trial' ELSE 'none' END END plan,
      CASE WHEN s.duration::text IN ('monthly','quarterly','yearly','lifetime') THEN s.duration::text WHEN s.tier::text LIKE '%\_lifetime' ESCAPE '\' OR s.tier::text='lifetime' THEN 'lifetime' WHEN split_part(s.tier::text,'_',2) IN ('monthly','quarterly','yearly') THEN split_part(s.tier::text,'_',2) ELSE NULL END duration,
      coalesce(s.end_date,s.trial_end_date) AS "expiresAt", u.last_sign_in_at AS "lastSignIn", (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed"
    FROM auth.users u LEFT JOIN public.profiles pr ON pr.id=u.id LEFT JOIN public.subscriptions s ON s.user_id=u.id LEFT JOIN public.tenants t ON t.id=pr.tenant_id
    WHERE NOT EXISTS (SELECT 1 FROM member_ids mi WHERE mi.member_user_id=u.id)
  ), enriched AS (
    SELECT o.*, coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.member_user_id,'membershipId',m.id,'email',coalesce(mu.email,m.email,'No Email'),'name',coalesce(mp.full_name,mu.raw_user_meta_data->>'full_name',split_part(m.email,'@',1),'No Name'),'roleName',coalesce(r.name,'Member'),'roleSlug',r.slug,'status',m.status,'createdAt',coalesce(mu.created_at,m.invited_at),'lastSignIn',mu.last_sign_in_at,'emailConfirmed',mu.email_confirmed_at IS NOT NULL)) FROM public.workspace_memberships m LEFT JOIN public.workspace_roles r ON r.id=m.role_id LEFT JOIN auth.users mu ON mu.id=m.member_user_id LEFT JOIN public.profiles mp ON mp.id=m.member_user_id WHERE m.owner_user_id=o.id AND m.status IN ('invited','active','disabled') AND (m.member_user_id IS NULL OR m.member_user_id<>m.owner_user_id)),'[]'::jsonb) members
    FROM owners o
  ), filtered AS (
    SELECT * FROM enriched WHERE (coalesce(btrim(p_query),'')='' OR name ILIKE '%'||p_query||'%' OR email ILIKE '%'||p_query||'%' OR members::text ILIKE '%'||p_query||'%')
      AND (p_package='all' OR plan=p_package) AND (p_duration='all' OR duration=p_duration)
      AND (p_expiry='all' OR (p_expiry='expired' AND duration<>'lifetime' AND "expiresAt"<now()) OR (p_expiry='active' AND NOT(duration IS DISTINCT FROM 'lifetime' AND "expiresAt" IS NOT NULL AND "expiresAt"<now())))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY CASE WHEN p_sort='oldest' THEN "registeredSortAt" END ASC,CASE WHEN p_sort='newest' THEN "registeredSortAt" END DESC,CASE WHEN p_sort='expiresSoon' THEN "expiresAt" END ASC NULLS LAST,CASE WHEN p_sort='expiresLatest' THEN "expiresAt" END DESC NULLS LAST,id
    LIMIT greatest(1,least(p_page_size,100)) OFFSET (least(greatest(1,p_page),greatest(1,ceil((SELECT count(*) FROM filtered)::numeric/greatest(1,least(p_page_size,100)))::integer))-1)*greatest(1,least(p_page_size,100))
  ), counts AS (SELECT count(*)::integer total,coalesce(sum(jsonb_array_length(members)),0)::integer member_count FROM filtered)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),'[]'::jsonb),'pagination',jsonb_build_object('page',least(greatest(1,p_page),greatest(1,ceil((SELECT total FROM counts)::numeric/greatest(1,least(p_page_size,100)))::integer)),'pageSize',greatest(1,least(p_page_size,100)),'total',(SELECT total FROM counts),'totalPages',greatest(1,ceil((SELECT total FROM counts)::numeric/greatest(1,least(p_page_size,100)))::integer)),'facets',jsonb_build_object('total',(SELECT count(*) FROM owners),'packages',(SELECT coalesce(jsonb_object_agg(plan,c),'{}'::jsonb) FROM (SELECT plan,count(*) c FROM owners GROUP BY plan)x),'durations',(SELECT coalesce(jsonb_object_agg(coalesce(duration,'none'),c),'{}'::jsonb) FROM (SELECT duration,count(*) c FROM owners GROUP BY duration)x),'expiry',jsonb_build_object('expired',(SELECT count(*) FROM owners WHERE duration IS DISTINCT FROM 'lifetime' AND "expiresAt"<now()),'active',(SELECT count(*) FROM owners WHERE NOT(duration IS DISTINCT FROM 'lifetime' AND "expiresAt" IS NOT NULL AND "expiresAt"<now()))),'memberCount',(SELECT member_count FROM counts)));
$function$;
REVOKE ALL ON FUNCTION public.admin_list_clientdesk_users(integer,integer,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clientdesk_users(integer,integer,text,text,text,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
