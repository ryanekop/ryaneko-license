import type { SupabaseClient } from '@supabase/supabase-js';

export type ClientDeskWorkspaceRole = {
    id: string;
    name: string | null;
    slug: string | null;
};

export type ClientDeskWorkspaceMembership = {
    id: string;
    owner_user_id: string;
    member_user_id: string | null;
    email: string;
    status: 'invited' | 'active' | 'disabled' | 'revoked';
    invited_at: string | null;
    accepted_at: string | null;
    role: ClientDeskWorkspaceRole | null;
};

function normalizeEmail(value: string | null | undefined) {
    return (value || '').trim().toLowerCase();
}

function normalizeRole(value: unknown): ClientDeskWorkspaceRole | null {
    const role = Array.isArray(value) ? value[0] : value;
    if (!role || typeof role !== 'object') return null;
    const row = role as Record<string, unknown>;
    return {
        id: typeof row.id === 'string' ? row.id : '',
        name: typeof row.name === 'string' ? row.name : null,
        slug: typeof row.slug === 'string' ? row.slug : null,
    };
}

function normalizeMembership(row: Record<string, unknown>): ClientDeskWorkspaceMembership {
    return {
        id: String(row.id || ''),
        owner_user_id: String(row.owner_user_id || ''),
        member_user_id: typeof row.member_user_id === 'string' ? row.member_user_id : null,
        email: normalizeEmail(typeof row.email === 'string' ? row.email : ''),
        status: row.status as ClientDeskWorkspaceMembership['status'],
        invited_at: typeof row.invited_at === 'string' ? row.invited_at : null,
        accepted_at: typeof row.accepted_at === 'string' ? row.accepted_at : null,
        role: normalizeRole(row.role),
    };
}

export function isClientDeskWorkspaceMember(
    membership: ClientDeskWorkspaceMembership | null | undefined,
) {
    return Boolean(
        membership &&
        (!membership.member_user_id || membership.member_user_id !== membership.owner_user_id),
    );
}

export async function listClientDeskWorkspaceMemberships(
    supabase: SupabaseClient,
): Promise<ClientDeskWorkspaceMembership[]> {
    const { data, error } = await supabase
        .from('workspace_memberships')
        .select(
            'id, owner_user_id, member_user_id, email, status, invited_at, accepted_at, role:workspace_roles(id, name, slug)',
        )
        .in('status', ['invited', 'active', 'disabled']);

    if (error) {
        if (/workspace_memberships|relation.*does not exist/i.test(error.message || '')) {
            console.warn('[ClientDesk Workspace] Membership tables are not available yet.');
            return [];
        }
        throw error;
    }

    return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeMembership);
}

export async function findClientDeskMembershipByUserId(
    supabase: SupabaseClient,
    userId: string,
) {
    const memberships = await listClientDeskWorkspaceMemberships(supabase);
    return memberships.find((row) => row.member_user_id === userId) || null;
}

export async function findClientDeskMemberByEmail(
    supabase: SupabaseClient,
    email: string,
) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const memberships = await listClientDeskWorkspaceMemberships(supabase);
    return memberships.find(
        (row) => row.email === normalizedEmail && isClientDeskWorkspaceMember(row),
    ) || null;
}

export async function listActiveClientDeskMembersForOwner(
    supabase: SupabaseClient,
    ownerUserId: string,
) {
    const memberships = await listClientDeskWorkspaceMemberships(supabase);
    return memberships.filter(
        (row) =>
            row.owner_user_id === ownerUserId &&
            row.status !== 'disabled' &&
            isClientDeskWorkspaceMember(row),
    );
}
