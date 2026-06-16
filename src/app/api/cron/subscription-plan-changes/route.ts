import { NextRequest, NextResponse } from 'next/server';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.SUBSCRIPTION_CRON_SECRET;
    if (!secret) return false;

    const authorization = request.headers.get('authorization') || '';
    const bearer = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7)
        : '';

    return bearer === secret || request.headers.get('x-cron-secret') === secret;
}

async function applyDuePlanChanges(request: NextRequest) {
    if (!process.env.SUBSCRIPTION_CRON_SECRET) {
        return NextResponse.json(
            { success: false, message: 'SUBSCRIPTION_CRON_SECRET is not configured' },
            { status: 500 },
        );
    }
    if (!isAuthorized(request)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getClientDeskSupabase();
        const { data, error } = await supabase.rpc('apply_due_subscription_plan_changes');
        if (error) throw error;

        return NextResponse.json({
            success: true,
            applied: Array.isArray(data) ? data.length : 0,
            changes: data || [],
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Subscription Cron] Failed to apply due plan changes:', error);
        return NextResponse.json({ success: false, message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return applyDuePlanChanges(request);
}

export async function POST(request: NextRequest) {
    return applyDuePlanChanges(request);
}
