import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const auth = await authenticateAdminRequest(request, { requireAal2: false });
    if (!auth.ok) return auth.response;
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 });
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: auth.context.user.id });
    if (error) return NextResponse.json({ error: 'factor_lookup_failed' }, { status: 500 });
    return NextResponse.json({
        user: { id: auth.context.user.id, email: auth.context.user.email },
        aal: auth.context.claims.aal || 'aal1',
        factors: (data?.factors || []).filter((factor) => factor.status === 'verified'),
    });
}
