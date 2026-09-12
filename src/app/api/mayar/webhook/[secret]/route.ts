import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { getMayarTransaction } from '@/lib/mayar-v2';
import { processVerifiedLegacyWebhook } from '@/app/api/mayar/webhook/route';

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const MAX_BODY_BYTES = 64 * 1024;

function equal(a: string, b: string) {
    return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(...values: unknown[]) {
    return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined;
}

function number(...values: unknown[]) {
    const value = values.find((item) => Number.isFinite(Number(item)));
    return value === undefined ? null : Math.round(Number(value));
}

export async function POST(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
    const expected = process.env.MAYAR_WEBHOOK_SECRET || '';
    const { secret } = await context.params;
    if (!expected || !secret || !equal(secret, expected)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const rate = limiter.check(getClientIp(request));
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (payload.event === 'testing' || payload.event === 'test') {
        return NextResponse.json({ success: true });
    }

    const data = record(payload.data);
    const customer = record(data.customer || payload.customer);
    const email = text(data.customerEmail, data.customer_email, customer.email, payload.customerEmail, payload.customer_email)?.toLowerCase();
    const amount = number(data.amount, data.totalAmount, data.gross_amount, payload.amount);

    const hintedIds = Array.from(new Set([
        text(data.transactionId), text(data.id), text(payload.transactionId), text(payload.id),
    ].filter((value): value is string => Boolean(value))));

    for (const transactionId of hintedIds) {
        try {
            const transaction = await getMayarTransaction(transactionId);
            if (transaction.status.toLowerCase() !== 'paid') continue;
            if (email && transaction.customer?.email?.toLowerCase() !== email) continue;
            if (amount !== null && Number(transaction.amount) !== amount) continue;
            const verifiedPayload = {
                ...payload,
                data: {
                    ...data,
                    id: transaction.id,
                    transactionId: transaction.id,
                    status: 'paid',
                    amount: transaction.amount,
                    customer: transaction.customer,
                    customerEmail: transaction.customer?.email,
                },
            };
            const verifiedRequest = new NextRequest(request.url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(verifiedPayload),
            });
            return processVerifiedLegacyWebhook(verifiedRequest);
        } catch {
            // A webhook ID is not payment evidence. Try only other hinted IDs.
        }
    }
    return NextResponse.json({ success: true });
}
