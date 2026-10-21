import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { createPagination, parseListParams } from '@/lib/pagination';
import {
    blocklistSearchFilter,
    FASTPIK_BLOCKLIST_COLUMNS,
    isValidBlocklistEmail,
    normalizeBlocklistEmail,
    resolveFastpikBlockedUserId,
    type FastpikBlockedEmail,
} from '@/lib/fastpik-blocklist';

function failure(error: unknown) {
    console.error('Fastpik blocklist error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update or load the Fastpik blocklist.' }, { status: 500 });
}

function invalid(message: string) {
    return NextResponse.json({ success: false, error: message }, { status: 400 });
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
    const body: unknown = await request.json().catch(() => null);
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

async function findEntry(body: Record<string, unknown>) {
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const email = normalizeBlocklistEmail(body.email);
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { invalid: 'Invalid blocklist ID.' };
    if (!id && !isValidBlocklistEmail(email)) return { invalid: 'A valid id or email is required.' };
    const query = getFastpikSupabase().from('auth_email_blocklist').select(FASTPIK_BLOCKLIST_COLUMNS);
    const { data, error } = await (id ? query.eq('id', id) : query.eq('email', email)).maybeSingle();
    if (error) throw error;
    return { entry: data as FastpikBlockedEmail | null };
}

export async function GET(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    try {
        const supabase = getFastpikSupabase();
        const { requestedPage, pageSize, q } = parseListParams(request.nextUrl.searchParams);
        const filter = q ? blocklistSearchFilter(q) : null;
        let countQuery = supabase.from('auth_email_blocklist').select('id', { count: 'exact', head: true });
        if (filter) countQuery = countQuery.or(filter);
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        const pagination = createPagination(count || 0, requestedPage, pageSize);
        let query = supabase.from('auth_email_blocklist').select(FASTPIK_BLOCKLIST_COLUMNS)
            .order('created_at', { ascending: false }).order('id', { ascending: true });
        if (filter) query = query.or(filter);
        const offset = (pagination.page - 1) * pagination.pageSize;
        const { data, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw error;
        return NextResponse.json({ success: true, items: data || [], pagination }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return failure(error);
    }
}

export async function POST(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    try {
        const body = await readBody(request);
        if (!body) return invalid('Invalid request body.');
        const email = normalizeBlocklistEmail(body.email);
        if (!isValidBlocklistEmail(email)) return invalid('A valid email is required.');
        if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') return invalid('Invalid reason.');
        const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
        if (reason && reason.length > 2000) return invalid('Reason must be at most 2000 characters.');
        const supabase = getFastpikSupabase();
        const { data: existing, error: lookupError } = await supabase.from('auth_email_blocklist')
            .select('suspended_user_id').eq('email', email).maybeSingle();
        if (lookupError) throw lookupError;
        const suspendedUserId = await resolveFastpikBlockedUserId(supabase, email, existing?.suspended_user_id || null);
        const { data, error } = await supabase.from('auth_email_blocklist').upsert({
            email, reason, is_active: true, suspended_user_id: suspendedUserId,
        }, { onConflict: 'email' }).select(FASTPIK_BLOCKLIST_COLUMNS).single();
        if (error) throw error;
        return NextResponse.json({ success: true, block: data }, { status: 201 });
    } catch (error) {
        return failure(error);
    }
}

export async function PUT(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    try {
        const body = await readBody(request);
        if (!body) return invalid('Invalid request body.');
        if (body.is_active !== undefined && typeof body.is_active !== 'boolean') return invalid('Invalid active status.');
        if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') return invalid('Invalid reason.');
        const result = await findEntry(body);
        if (result.invalid) return invalid(result.invalid);
        const entry = result.entry;
        if (!entry) return NextResponse.json({ success: false, error: 'Blocklist entry not found.' }, { status: 404 });
        const updates: { reason?: string | null; is_active?: boolean; suspended_user_id?: string | null } = {};
        if ('reason' in body) {
            updates.reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
            if (updates.reason && updates.reason.length > 2000) return invalid('Reason must be at most 2000 characters.');
        }
        if (typeof body.is_active === 'boolean') {
            updates.is_active = body.is_active;
            if (body.is_active) updates.suspended_user_id = await resolveFastpikBlockedUserId(getFastpikSupabase(), entry.email, entry.suspended_user_id);
        }
        if (Object.keys(updates).length === 0) return invalid('No updates provided.');
        const { data, error } = await getFastpikSupabase().from('auth_email_blocklist').update(updates)
            .eq('id', entry.id).select(FASTPIK_BLOCKLIST_COLUMNS).single();
        if (error) throw error;
        return NextResponse.json({ success: true, block: data });
    } catch (error) {
        return failure(error);
    }
}

export async function DELETE(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    try {
        const body = await readBody(request);
        if (!body) return invalid('Invalid request body.');
        const result = await findEntry(body);
        if (result.invalid) return invalid(result.invalid);
        if (!result.entry) return NextResponse.json({ success: false, error: 'Blocklist entry not found.' }, { status: 404 });
        const { error } = await getFastpikSupabase().from('auth_email_blocklist').delete().eq('id', result.entry.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return failure(error);
    }
}
