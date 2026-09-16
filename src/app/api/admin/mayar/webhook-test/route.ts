import { NextRequest, NextResponse } from 'next/server';
import { processVerifiedLegacyWebhook } from '@/app/api/mayar/webhook/route';
import { requireAdmin } from '@/lib/admin-auth';

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return NextResponse.json({ status: 'Error', message: 'Payload too large' }, { status: 413 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ status: 'Error', message: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return NextResponse.json({ status: 'Error', message: 'Payload must be a JSON object' }, { status: 400 });
    }

    const trustedRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return processVerifiedLegacyWebhook(trustedRequest);
}
