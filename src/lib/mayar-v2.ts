export type MayarEnvironment = 'sandbox' | 'production';

type MayarEnvelope<T> = {
    statusCode?: number;
    messages?: string;
    message?: string;
    data?: T;
    hasMore?: boolean;
    nextStartingAfter?: string | null;
};

export type MayarPaymentRequest = {
    id: string;
    transactionId?: string;
    amount?: number;
    link?: string;
    linkUrl?: string;
    linkPayment?: string;
    redirectUrl?: string | null;
    status?: string;
    extraData?: Record<string, unknown> | null;
    transactions?: Array<{ id: string; extraData?: Record<string, unknown> | null }>;
};

export type MayarTransaction = {
    id: string;
    extraData: Record<string, unknown> | null;
    amount: number;
    status: string;
    expirationDate?: number;
    paymentMethod?: string;
    customer?: { email?: string; name?: string; mobile?: string };
};

type RawMayarTransaction = Omit<MayarTransaction, 'extraData'> & { extraData?: unknown };
type RawMayarPaymentRequest = Omit<MayarPaymentRequest, 'extraData' | 'transactions'> & {
    extraData?: unknown;
    transactions?: Array<{ id: string; extraData?: unknown }>;
};

// Production can serialize this field as JSON text instead of returning an object.
// Invalid metadata stays unusable for payment identity checks.
export function normalizeMayarExtraData(value: unknown): Record<string, unknown> | null {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); }
        catch { return null; }
    }
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function normalizePaymentRequest(payment: RawMayarPaymentRequest): MayarPaymentRequest {
    return {
        ...payment,
        extraData: normalizeMayarExtraData(payment.extraData),
        transactions: payment.transactions?.map(transaction => ({
            ...transaction, extraData: normalizeMayarExtraData(transaction.extraData),
        })),
    };
}

export type ImmutableCheckoutResponse = {
    checkoutLink: string;
};

const MAYAR_REQUEST_TIMEOUT_MS = 12_000;

const DEFAULT_BASE_URL: Record<MayarEnvironment, string> = {
    sandbox: 'https://api.mayar.io/hl/v2',
    production: 'https://api.mayar.id/hl/v2',
};

function getMayarV2BaseUrl(environment: MayarEnvironment) {
    return process.env.MAYAR_V2_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL[environment];
}

export class MayarApiError extends Error {
    readonly statusCode: number;
    readonly retryAfter: string | null;

    constructor(message: string, statusCode: number, retryAfter: string | null = null) {
        super(message);
        this.name = 'MayarApiError';
        this.statusCode = statusCode;
        this.retryAfter = retryAfter;
    }
}

export function getMayarConfig() {
    const apiKey = process.env.MAYAR_API_KEY;
    if (!apiKey) throw new Error('MAYAR_API_KEY is not configured');
    return {
        apiKey,
        environment: process.env.MAYAR_ENV === 'production' ? 'production' as const : 'sandbox' as const,
    };
}

async function mayarEnvelope<T>(path: string, init: RequestInit = {}, requireData = true) {
    const config = getMayarConfig();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${config.apiKey}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${getMayarV2BaseUrl(config.environment)}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
        signal: init.signal || AbortSignal.timeout(MAYAR_REQUEST_TIMEOUT_MS),
    });
    let body: MayarEnvelope<T>;
    try {
        body = await response.json() as MayarEnvelope<T>;
    } catch {
        throw new MayarApiError(`Mayar returned HTTP ${response.status}`, response.status, response.headers.get('retry-after'));
    }
    const statusCode = body.statusCode ?? response.status;
    if (!response.ok || statusCode >= 400 || (requireData && !body.data)) {
        throw new MayarApiError(
            body.messages ?? body.message ?? `Mayar returned HTTP ${response.status}`,
            statusCode,
            response.headers.get('retry-after'),
        );
    }
    return body as MayarEnvelope<T> & { data: T };
}

export async function mayarFetch<T>(path: string, init: RequestInit = {}) {
    return (await mayarEnvelope<T>(path, init)).data;
}

export async function listMayarPaymentRequests(cursor?: string) {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('startingAfter', cursor);
    const body = await mayarEnvelope<RawMayarPaymentRequest[]>(`/payments?${params}`);
    return { items: body.data.map(normalizePaymentRequest), hasMore: body.hasMore === true, cursor: body.nextStartingAfter || null };
}

export async function getMayarPaymentRequest(paymentId: string) {
    return normalizePaymentRequest(await mayarFetch<RawMayarPaymentRequest>(`/payments/${encodeURIComponent(paymentId)}`));
}

export async function closeMayarPaymentRequest(paymentId: string) {
    const body = await mayarEnvelope<null>(`/payments/${encodeURIComponent(paymentId)}/close`, { method: 'POST' }, false);
    if (body.messages !== 'success' && body.message !== 'success') {
        throw new MayarApiError('Mayar did not close the payment request', 502);
    }
}

export function extractPaymentCheckoutUrl(value: unknown, environment: MayarEnvironment): string | null {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        // Mayar's payment request examples use merchant myr.id links in both environments.
        const validHost = isAllowedMayarCheckoutHost(url.hostname, environment) ||
            (environment === 'sandbox' && url.hostname.endsWith('.myr.id'));
        return url.protocol === 'https:' && validHost && !url.username && !url.password ? url.toString() : null;
    } catch {
        return null;
    }
}

function isAllowedMayarCheckoutHost(hostname: string, environment: MayarEnvironment) {
    if (environment === 'sandbox') return hostname === 'web.mayar.io' || hostname.endsWith('.mayar.shop');
    return hostname === 'web.mayar.id' || hostname.endsWith('.myr.id') || hostname.endsWith('.mayar.shop');
}

function validCheckoutUrl(value: unknown, environment: MayarEnvironment) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' &&
            isAllowedMayarCheckoutHost(url.hostname, environment) &&
            url.searchParams.has('immutable')
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}

export function extractImmutableCheckoutUrl(
    value: unknown,
    environment: MayarEnvironment,
    membershipTierId?: string,
    depth = 0,
): string | null {
    if (depth > 3) return null;
    const direct = validCheckoutUrl(value, environment);
    if (direct) return direct;
    if (Array.isArray(value)) {
        for (const item of value) {
            if (membershipTierId && item && typeof item === 'object' && !Array.isArray(item)) {
                const tier = item as Record<string, unknown>;
                if (tier.id !== membershipTierId) continue;
                const match = validCheckoutUrl(tier.specificPaymentLinkUrl, environment);
                if (match) return match;
                continue;
            }
            const match = extractImmutableCheckoutUrl(item, environment, membershipTierId, depth + 1);
            if (match) return match;
        }
        return null;
    }
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    for (const key of ['checkoutLink']) {
        const match = validCheckoutUrl(row[key], environment);
        if (match) return match;
    }
    for (const key of ['membershipTiers', 'data', 'result']) {
        const match = extractImmutableCheckoutUrl(row[key], environment, membershipTierId, depth + 1);
        if (match) return match;
    }
    return null;
}

export function describeResponseShape(value: unknown) {
    if (Array.isArray(value)) return { type: 'array', length: value.length };
    if (value && typeof value === 'object') {
        return { type: 'object', keys: Object.keys(value as Record<string, unknown>).sort().slice(0, 20) };
    }
    return { type: typeof value };
}

export async function getMayarTransaction(transactionId: string): Promise<MayarTransaction> {
    const transaction = await mayarFetch<RawMayarTransaction>(`/transactions/${encodeURIComponent(transactionId)}`);
    return { ...transaction, extraData: normalizeMayarExtraData(transaction.extraData) };
}

export async function generateImmutableCheckout(input: {
    productId: string;
    membershipTierId: string;
    customerInfo: { name: string; email: string; mobile: string };
    creditAmount: number;
}) {
    const config = getMayarConfig();
    const response = await fetch(`${getMayarV2BaseUrl(config.environment).replace(/\/hl\/v2$/, '')}/credit/v2/credit/generate/immutable/checkout`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            productId: input.productId,
            customerInfo: input.customerInfo,
            creditAmount: input.creditAmount,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(MAYAR_REQUEST_TIMEOUT_MS),
    });
    let body: MayarEnvelope<ImmutableCheckoutResponse>;
    try {
        body = await response.json() as MayarEnvelope<ImmutableCheckoutResponse>;
    } catch {
        throw new MayarApiError(`Mayar returned HTTP ${response.status}`, response.status);
    }
    const statusCode = body.statusCode ?? response.status;
    if (!response.ok || statusCode >= 400) {
        throw new MayarApiError(
            body.messages ?? body.message ?? `Mayar returned HTTP ${response.status}`,
            statusCode,
            response.headers.get('retry-after'),
        );
    }
    const checkoutUrl = extractImmutableCheckoutUrl(body, config.environment, input.membershipTierId);
    if (!checkoutUrl) {
        console.warn('[Mayar Immutable Checkout] Unrecognized response shape:', {
            envelope: describeResponseShape(body),
            data: describeResponseShape(body.data),
        });
        throw new Error('Mayar returned an unrecognized checkout response');
    }
    return checkoutUrl;
}
