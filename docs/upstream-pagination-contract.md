# Fastpik and ClientDesk admin list contract

The Ryan Eko License proxies now forward these query parameters to upstream admin APIs:

- `page`: positive integer, clamped to the last available page.
- `pageSize`: one of `10`, `25`, `50`, or `100` (default `25`).
- `q`: trimmed case-insensitive search term.
- Resource-specific filters such as `status`, `sort`, and `ids`.

All upstream list handlers should return:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 1
  },
  "facets": {}
}
```

## Upstream handlers

- Fastpik `GET /api/admin/tenants`: paginate and search `name`, `slug`, and `domain` before serializing rows.
- ClientDesk `GET /api/admin/tenants`: same tenant behavior.
- ClientDesk `GET /api/admin/tenant-accounts`: remains paginated for compatibility; the users screen no longer depends on it because account fields come from the users RPC.
- ClientDesk `GET /api/admin/auth-blocklist`: paginate after applying email/reason search.
- ClientDesk `GET /api/admin/client-email-domains`: paginate after status and studio/domain/provider search.

The Ryan Eko License proxy still normalizes legacy array responses during a staggered deployment. After both upstream apps are live, all filtering and ranges are performed before serialization.

Canonical migrations live in Fastpik `supa_migrations/20260818_admin_users_pagination.sql` and ClientDesk `supabase_migration_admin_list_pagination.sql`. The copies under this repository's `migration/` directory document the Ryan Eko License integration side.
