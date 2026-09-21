import { NextRequest, NextResponse } from 'next/server';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { verifyCheckoutServiceSignature } from '@/lib/internal-checkout-signature';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
    const bodyText = await request.text();
    if (!verifyCheckoutServiceSignature({
        body: bodyText,
        method: request.method,
        path: request.nextUrl.pathname,
        timestamp: request.headers.get('x-ryaneko-timestamp'),
        signature: request.headers.get('x-ryaneko-signature'),
    })) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: { email?: unknown };
    try {
        body = JSON.parse(bodyText) as { email?: unknown };
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    try {
        const supabase = getFastpikSupabase();
        let page = 1;
        while (true) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) throw error;
            const users = data?.users || [];
            if (users.some((user) => user.email?.trim().toLowerCase() === email)) {
                return NextResponse.json({ exists: true });
            }
            if (users.length < 1000) break;
            page += 1;
        }
        return NextResponse.json({ exists: false });
    } catch (error) {
        console.error('[Fastpik Account Exists] Failed:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json({ error: 'Fastpik account lookup unavailable' }, { status: 503 });
    }
}
