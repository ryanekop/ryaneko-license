import type { SupabaseClient } from '@supabase/supabase-js';

export const FASTPIK_BLOCKLIST_COLUMNS = 'id, email, reason, is_active, suspended_user_id, created_at, updated_at';

export interface FastpikBlockedEmail {
    id: string;
    email: string;
    reason: string | null;
    is_active: boolean;
    suspended_user_id: string | null;
    created_at: string;
    updated_at: string;
}

export function normalizeBlocklistEmail(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidBlocklistEmail(value: string): boolean {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function blocklistSearchFilter(search: string): string {
    // Quote PostgREST filter values so commas/parentheses cannot alter the filter.
    const pattern = JSON.stringify(`%${search.replace(/[\\%_*]/g, '\\$&')}%`);
    return `email.ilike.${pattern},reason.ilike.${pattern}`;
}

export async function findFastpikUserByEmail(supabase: SupabaseClient, email: string) {
    const normalizedEmail = normalizeBlocklistEmail(email);
    for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const users = data?.users || [];
        const user = users.find((entry) => normalizeBlocklistEmail(entry.email) === normalizedEmail);
        if (user) return user;
        if (users.length < 1000) return null;
    }
}

export async function findActiveFastpikBlock(supabase: SupabaseClient, email: string, userId?: string | null) {
    const normalizedEmail = normalizeBlocklistEmail(email);
    const { data: emailBlock, error: emailError } = await supabase.from('auth_email_blocklist')
        .select('id').eq('email', normalizedEmail).eq('is_active', true).maybeSingle();
    if (emailError) throw emailError;
    if (emailBlock) return emailBlock;

    const resolvedUserId = userId || (await findFastpikUserByEmail(supabase, normalizedEmail))?.id;
    if (!resolvedUserId) return null;
    const { data, error } = await supabase.from('auth_email_blocklist')
        .select('id').eq('suspended_user_id', resolvedUserId).eq('is_active', true).limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

export async function resolveFastpikBlockedUserId(supabase: SupabaseClient, email: string, existingId: string | null) {
    // Keep the original account suspended even if it has since changed its email.
    return existingId || (await findFastpikUserByEmail(supabase, email))?.id || null;
}
