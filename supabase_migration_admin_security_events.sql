create table if not exists public.admin_security_events (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid not null,
    actor_email text,
    action text not null,
    target_user_id uuid,
    target_email text,
    reason text,
    factor_count integer not null default 0,
    outcome text not null,
    ip_address text,
    user_agent text,
    error_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.admin_security_events enable row level security;
revoke all on public.admin_security_events from anon, authenticated;

create or replace function public.prevent_admin_security_event_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
    raise exception 'admin_security_events is append-only';
end;
$$;

drop trigger if exists admin_security_events_append_only on public.admin_security_events;
create trigger admin_security_events_append_only
before update or delete on public.admin_security_events
for each row execute function public.prevent_admin_security_event_changes();

create index if not exists admin_security_events_created_at_idx on public.admin_security_events (created_at desc);
create index if not exists admin_security_events_target_idx on public.admin_security_events (target_user_id, created_at desc);
