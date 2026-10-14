import { NextRequest, NextResponse } from 'next/server';
import { getSoftwareStoreOrigins } from '@/lib/software-store';
import { getSoftwarePurchaseFeed } from '@/lib/software-purchase-feed';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

function headers(request: NextRequest) {
    const result = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const origin = request.headers.get('origin');
    if (origin && getSoftwareStoreOrigins().has(origin)) {
        result.set('Access-Control-Allow-Origin', origin);
        result.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }
    return result;
}

function originDenied(request: NextRequest) {
    const origin = request.headers.get('origin');
    return origin && !getSoftwareStoreOrigins().has(origin);
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: originDenied(request) ? 403 : 204, headers: headers(request) });
}

export async function GET(request: NextRequest) {
    const result = headers(request);
    if (originDenied(request)) return NextResponse.json({ error: 'Origin denied' }, { status: 403, headers: result });
    const rate = limiter.check(`software-purchase-feed:${getClientIp(request)}`);
    if (!rate.allowed) {
        result.set('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000)));
        return NextResponse.json({ error: 'Please try again later' }, { status: 429, headers: result });
    }
    return NextResponse.json(await getSoftwarePurchaseFeed(), { headers: result });
}
