import { NextRequest, NextResponse } from 'next/server';
import { verifyCheckoutServiceSignature } from '@/lib/internal-checkout-signature';
import {
    BUNDLE_PRICE_CATALOG,
    CLIENT_DESK_PRICE_CATALOG,
    FASTPIK_PRICE_CATALOG,
    type ClientDeskPlan,
    type SubscriptionDuration,
} from '@/lib/mayar-subscription-catalog';
import { generateImmutableCheckout, MayarApiError } from '@/lib/mayar-v2';

type CheckoutOffer = 'standalone' | 'bundle' | 'fastpik';

const OFFERS = new Set<CheckoutOffer>(['standalone', 'bundle', 'fastpik']);
const PLANS = new Set<ClientDeskPlan>(['basic', 'plus', 'pro']);
const DURATIONS = new Set<SubscriptionDuration>(['monthly', 'quarterly', 'yearly']);

function validCustomerInfo(value: unknown): value is { name: string; email: string; mobile: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    return (
        typeof row.name === 'string' && row.name.trim().length > 0 && row.name.length <= 160 &&
        typeof row.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) && row.email.length <= 320 &&
        typeof row.mobile === 'string' && /^\+[1-9]\d{7,14}$/.test(row.mobile)
    );
}

export async function POST(request: NextRequest) {
    const bodyText = await request.text();
    const timestamp = request.headers.get('x-ryaneko-timestamp');
    const signature = request.headers.get('x-ryaneko-signature');
    if (!verifyCheckoutServiceSignature({
        body: bodyText,
        method: request.method,
        path: request.nextUrl.pathname,
        timestamp,
        signature,
    })) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (
        !OFFERS.has(body.offer as CheckoutOffer) ||
        !PLANS.has(body.plan as ClientDeskPlan) ||
        !DURATIONS.has(body.duration as SubscriptionDuration) ||
        !validCustomerInfo(body.customerInfo)
    ) {
        return NextResponse.json({ error: 'Invalid checkout selection' }, { status: 400 });
    }

    const offer = body.offer as CheckoutOffer;
    const plan = body.plan as ClientDeskPlan;
    const duration = body.duration as SubscriptionDuration;
    const price = offer === 'fastpik'
        ? FASTPIK_PRICE_CATALOG.find((entry) => entry.duration === duration)?.price
        : (offer === 'bundle' ? BUNDLE_PRICE_CATALOG : CLIENT_DESK_PRICE_CATALOG)
            .find((entry) => entry.plan === plan && entry.duration === duration)?.price;
    const productId = offer === 'fastpik'
        ? process.env.MAYAR_FASTPIK_PRODUCT_ID
        : offer === 'bundle'
            ? process.env.MAYAR_CLIENTDESK_FASTPIK_BUNDLE_PRODUCT_ID
            : process.env.MAYAR_CLIENTDESK_PRODUCT_ID;
    const membershipTierId = offer === 'fastpik'
        ? process.env.MAYAR_FASTPIK_TIER_ID
        : offer === 'bundle'
            ? process.env[`MAYAR_BUNDLE_${plan.toUpperCase()}_TIER_ID`]
            : process.env[`MAYAR_CLIENTDESK_${plan.toUpperCase()}_TIER_ID`];
    if (!price || !productId || !membershipTierId) {
        return NextResponse.json({ error: 'Checkout product is not configured' }, { status: 503 });
    }

    try {
        const checkoutUrl = await generateImmutableCheckout({
            productId,
            membershipTierId,
            customerInfo: {
                name: body.customerInfo.name.trim(),
                email: body.customerInfo.email.trim().toLowerCase(),
                mobile: body.customerInfo.mobile,
            },
            creditAmount: price,
        });
        return NextResponse.json({ checkoutUrl });
    } catch (error) {
        console.error('[Mayar Immutable Checkout] Failed:', error instanceof Error ? error.message : 'unknown');
        const status = error instanceof MayarApiError && error.statusCode === 429 ? 429 : 502;
        return NextResponse.json({ error: status === 429 ? 'Tunggu sebentar lalu coba kembali.' : 'Mayar checkout belum tersedia.' }, { status });
    }
}
