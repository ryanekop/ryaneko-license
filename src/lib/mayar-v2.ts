export type MayarEnvironment = 'sandbox' | 'production';

type MayarEnvelope<T> = {
    statusCode?: number;
    messages?: string;
    message?: string;
    data?: T;
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

export type ImmutableCheckoutResponse = {
    checkoutLink: string;
};

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

export async function mayarFetch<T>(path: string, init: RequestInit = {}) {
    const config = getMayarConfig();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${config.apiKey}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${getMayarV2BaseUrl(config.environment)}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
    });
    let body: MayarEnvelope<T>;
    try {
        body = await response.json() as MayarEnvelope<T>;
    } catch {
        throw new MayarApiError(`Mayar returned HTTP ${response.status}`, response.status, response.headers.get('retry-after'));
    }
    const statusCode = body.statusCode ?? response.status;
    if (!response.ok || statusCode >= 400 || !body.data) {
        throw new MayarApiError(
            body.messages ?? body.message ?? `Mayar returned HTTP ${response.status}`,
            statusCode,
            response.headers.get('retry-after'),
        );
    }
    return body.data;
}

export function getMayarTransaction(transactionId: string) {
    return mayarFetch<MayarTransaction>(`/transactions/${encodeURIComponent(transactionId)}`);
}

export async function generateImmutableCheckout(input: {
    productId: string;
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
        body: JSON.stringify(input),
        cache: 'no-store',
    });
    let body: MayarEnvelope<ImmutableCheckoutResponse>;
    try {
        body = await response.json() as MayarEnvelope<ImmutableCheckoutResponse>;
    } catch {
        throw new MayarApiError(`Mayar returned HTTP ${response.status}`, response.status);
    }
    const statusCode = body.statusCode ?? response.status;
    if (!response.ok || statusCode >= 400 || !body.data?.checkoutLink) {
        throw new MayarApiError(
            body.messages ?? body.message ?? `Mayar returned HTTP ${response.status}`,
            statusCode,
            response.headers.get('retry-after'),
        );
    }
    const checkoutUrl = new URL(body.data.checkoutLink);
    const expectedHost = config.environment === 'production' ? 'web.mayar.id' : 'web.mayar.io';
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== expectedHost) {
        throw new Error('Mayar returned an unexpected checkout URL');
    }
    return checkoutUrl.toString();
}
