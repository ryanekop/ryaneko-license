import { NextRequest, NextResponse } from 'next/server';
import {
    createSoftwareCheckout, getSoftwareHistory, getSoftwareHistoryDetail, getSoftwareReceipt,
    getSoftwareStoreCatalog, getSoftwareStoreOrigins, requestSoftwareOtp, SoftwareStoreError, verifySoftwareOtp,
} from '@/lib/software-store';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const limiter = createRateLimiter({ limit: 100, windowMs: 60_000 });
const checkoutLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const MAX_BODY_BYTES = 8 * 1024;

function headers(request: NextRequest) {
    const result = new Headers({
        'Cache-Control': 'no-store, private', Vary: 'Origin',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    });
    const origin = request.headers.get('origin');
    if (origin && getSoftwareStoreOrigins().has(origin)) {
        result.set('Access-Control-Allow-Origin', origin);
        result.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        result.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    return result;
}

function response(request: NextRequest, value: unknown, status = 200, retryAfterSeconds?: number) {
    const result = headers(request);
    if (retryAfterSeconds) result.set('Retry-After', String(retryAfterSeconds));
    return NextResponse.json(value, { status, headers: result });
}

function originAllowed(request: NextRequest) {
    const origin = request.headers.get('origin');
    // Browser requests must come from an explicit origin; non-browser clients still require capabilities.
    return !origin || getSoftwareStoreOrigins().has(origin);
}

export async function OPTIONS(request: NextRequest) {
    if (!originAllowed(request)) return response(request, { code: 'origin_denied', error: 'Origin denied' }, 403);
    return new NextResponse(null, { status: 204, headers: headers(request) });
}

export async function GET(request: NextRequest) {
    if (!originAllowed(request)) return response(request, { code: 'origin_denied', error: 'Origin denied' }, 403);
    return response(request, getSoftwareStoreCatalog());
}

export async function POST(request: NextRequest) {
    if (!originAllowed(request)) return response(request, { code: 'origin_denied', error: 'Origin denied' }, 403);
    const ip = getClientIp(request);
    const rate = limiter.check(`store:${ip}`);
    if (!rate.allowed) {
        const seconds = Math.ceil(rate.retryAfterMs / 1000);
        return response(request, { code: 'rate_limited', error: 'Please try again later', retryAfterSeconds: seconds }, 429, seconds);
    }
    try {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('application/json')) throw new SoftwareStoreError('invalid_request', 415);
        const declaredSize = Number(request.headers.get('content-length') || 0);
        if (declaredSize > MAX_BODY_BYTES) throw new SoftwareStoreError('payload_too_large', 413);
        const raw = await request.text();
        if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new SoftwareStoreError('payload_too_large', 413);
        let body: Record<string, unknown>;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
            body = parsed as Record<string, unknown>;
        } catch { throw new SoftwareStoreError('invalid_request'); }
        const authorization = request.headers.get('authorization') || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        let result: unknown;
        switch (body.action) {
            case 'checkout': {
                const checkoutRate = checkoutLimiter.check(`checkout:${ip}`);
                if (!checkoutRate.allowed) throw new SoftwareStoreError('rate_limited', 429, Math.ceil(checkoutRate.retryAfterMs / 1000));
                result = await createSoftwareCheckout(body.customer, body.count, token, body.supersedesToken);
                break;
            }
            case 'order': result = await getSoftwareReceipt(body.orderId, token, body.refresh === true); break;
            case 'otp-request': result = await requestSoftwareOtp(body.email, ip); break;
            case 'otp-verify': result = await verifySoftwareOtp(body.email, body.code); break;
            case 'history': result = await getSoftwareHistory(token, body.page); break;
            case 'detail': result = await getSoftwareHistoryDetail(token, body.orderId, body.purchaseId); break;
            default: throw new SoftwareStoreError('invalid_action');
        }
        return response(request, result);
    } catch (error) {
        if (error instanceof SoftwareStoreError) {
            return response(request, {
                code: error.code, error: error.code,
                ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
            }, error.status, error.retryAfterSeconds);
        }
        // Provider/database messages can contain buyer data or capability URLs.
        console.error('[Software Store] Request failed', { type: error instanceof Error ? error.name : 'Unknown' });
        return response(request, { code: 'service_unavailable', error: 'Service unavailable' }, 503);
    }
}
