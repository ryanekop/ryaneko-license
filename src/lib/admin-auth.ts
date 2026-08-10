import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export type AdminAuthContext = { user: User; accessToken: string; claims: Record<string, unknown> };

function allowedAdminIds() {
    return new Set((process.env.RYANEKO_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
}

function bearerToken(request: NextRequest | Request) {
    const value = request.headers.get('authorization') || '';
    return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function decodeClaims(token: string): Record<string, unknown> {
    try {
        const payload = token.split('.')[1];
        return payload ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) : {};
    } catch { return {}; }
}

export function isSameOriginAdminMutation(request: NextRequest | Request) {
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    const origin = request.headers.get('origin');
    return origin === new URL(request.url).origin && request.headers.get('x-ryaneko-csrf') === '1';
}

export async function authenticateAdminRequest(
    request: NextRequest | Request,
    options: { requireAal2?: boolean; requireFreshTotp?: boolean } = {},
): Promise<{ ok: true; context: AdminAuthContext } | { ok: false; response: NextResponse }> {
    const accessToken = bearerToken(request);
    const admin = getSupabaseAdmin();
    if (!accessToken || !admin) return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    if (!allowedAdminIds().has(data.user.id)) return { ok: false, response: NextResponse.json({ error: 'admin_not_allowed' }, { status: 403 }) };
    const claims = decodeClaims(accessToken);
    if (options.requireAal2 !== false && claims.aal !== 'aal2') return { ok: false, response: NextResponse.json({ error: 'aal2_required' }, { status: 403 }) };
    if (options.requireAal2 !== false) {
        const { data: factorData, error: factorError } = await admin.auth.admin.mfa.listFactors({ userId: data.user.id });
        const verifiedFactors = (factorData?.factors || []).filter((factor) => factor.status === 'verified');
        if (factorError || verifiedFactors.length < 2) {
            return { ok: false, response: NextResponse.json({ error: factorError ? 'factor_lookup_failed' : 'two_totp_factors_required' }, { status: 403 }) };
        }
    }
    if (options.requireFreshTotp) {
        const amr = Array.isArray(claims.amr) ? claims.amr as Array<{ method?: string; timestamp?: number }> : [];
        const latest = Math.max(0, ...amr.filter((entry) => entry.method === 'totp').map((entry) => Number(entry.timestamp) || 0));
        if (!latest || Math.floor(Date.now() / 1000) - latest > 300) return { ok: false, response: NextResponse.json({ error: 'fresh_totp_required' }, { status: 403 }) };
    }
    return { ok: true, context: { user: data.user, accessToken, claims } };
}

export async function requireAdmin(request: NextRequest | Request, options?: { requireFreshTotp?: boolean }) {
    if (!isSameOriginAdminMutation(request)) return { ok: false as const, response: NextResponse.json({ error: 'csrf_rejected' }, { status: 403 }) };
    return authenticateAdminRequest(request, { requireAal2: true, ...options });
}
