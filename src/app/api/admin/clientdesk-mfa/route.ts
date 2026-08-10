import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const userId = request.nextUrl.searchParams.get('userId')?.trim();
    if (!userId) return NextResponse.json({ outcome: 'invalid_request', error: 'userId_required' }, { status: 400 });
    const clientdesk = getClientDeskSupabase();
    const [{ data: userData, error: userError }, { data: factorData, error: factorError }] = await Promise.all([
        clientdesk.auth.admin.getUserById(userId),
        clientdesk.auth.admin.mfa.listFactors({ userId }),
    ]);
    if (userError || !userData.user) return NextResponse.json({ outcome: 'not_found' }, { status: 404 });
    if (factorError) return NextResponse.json({ outcome: 'factor_lookup_failed' }, { status: 502 });
    const factors = (factorData?.factors || []).map((factor) => ({
        id: factor.id, type: factor.factor_type, status: factor.status,
        friendlyName: factor.friendly_name || null, createdAt: factor.created_at, updatedAt: factor.updated_at,
    }));
    return NextResponse.json({
        outcome: factors.length ? 'ok' : 'no_factors',
        user: { id: userData.user.id, email: userData.user.email },
        recoveryRequired: userData.user.app_metadata?.clientdesk_mfa_recovery_required === true,
        factors,
    });
}
