import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extractImmutableCheckoutUrl, generateImmutableCheckout, getMayarPaymentRequest,
    getMayarTransaction, listMayarPaymentRequests, normalizeMayarExtraData,
} from './mayar-v2.ts';
import { softwareTransactionMatches } from './software-store.ts';

const orderMetadata = { software_order_id: 'order-1', software_attempt_id: 'attempt-1' };
// Synthetic fixture with the same metadata representation observed in production.
const productionTransaction = {
    id: 'transaction-1', amount: 109000, status: 'paid',
    customer: { email: 'buyer@example.test' }, extraData: JSON.stringify(orderMetadata),
};

test('normalizes object and JSON-text metadata without accepting invalid values', () => {
    assert.equal(normalizeMayarExtraData(orderMetadata), orderMetadata);
    assert.deepEqual(normalizeMayarExtraData(JSON.stringify(orderMetadata)), orderMetadata);
    for (const value of [undefined, null, '', '{broken', [], '[]', 'null', 'true', '123', '"text"', 123, true]) {
        assert.equal(normalizeMayarExtraData(value), null);
    }
});

test('normalizes metadata at transaction, payment detail and paginated list boundaries', async () => {
    const previousFetch = globalThis.fetch;
    const keys = ['MAYAR_API_KEY', 'MAYAR_ENV', 'MAYAR_V2_API_BASE_URL'] as const;
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    process.env.MAYAR_API_KEY = 'test-key';
    process.env.MAYAR_ENV = 'production';
    process.env.MAYAR_V2_API_BASE_URL = 'https://provider.example.test/hl/v2';
    const payment = {
        id: 'payment-1', status: 'paid', extraData: JSON.stringify(orderMetadata),
        transactions: [{ id: 'transaction-1', extraData: productionTransaction.extraData }],
    };
    const urls: string[] = [];
    globalThis.fetch = async input => {
        const url = new URL(String(input));
        urls.push(url.pathname + url.search);
        const data = url.pathname.includes('/transactions/') ? productionTransaction :
            url.pathname.endsWith('/payments') ? [payment, { id: 'payment-2', extraData: null, transactions: [] }] : payment;
        return new Response(JSON.stringify({ statusCode: 200, data, hasMore: true, nextStartingAfter: 'next-page' }), {
            headers: { 'content-type': 'application/json' },
        });
    };
    try {
        const transaction = await getMayarTransaction('transaction-1');
        assert.deepEqual(transaction.extraData, orderMetadata);
        assert.equal(transaction.status, 'paid');
        assert.deepEqual(transaction.customer, productionTransaction.customer);
        const order = { id: 'order-1', amount: 109000, customer_email: 'buyer@example.test' };
        const attempt = { id: 'attempt-1', transaction_id: 'transaction-1' };
        assert.equal(softwareTransactionMatches(order, attempt, transaction), true);
        for (const patch of [
            { status: 'unpaid' }, { amount: 1 }, { id: 'other-transaction' },
            { customer: { email: 'other@example.test' } },
            { extraData: { ...orderMetadata, software_order_id: 'other-order' } },
            { extraData: { ...orderMetadata, software_attempt_id: 'other-attempt' } },
            { extraData: null },
        ]) assert.equal(softwareTransactionMatches(order, attempt, { ...transaction, ...patch }), false);
        const detail = await getMayarPaymentRequest('payment-1');
        assert.deepEqual(detail.extraData, orderMetadata);
        assert.deepEqual(detail.transactions?.[0].extraData, orderMetadata);
        const page = await listMayarPaymentRequests('previous-page');
        assert.deepEqual(page.items[0].transactions?.[0].extraData, orderMetadata);
        assert.deepEqual(page.items[0].extraData, orderMetadata);
        assert.equal(page.items[1].extraData, null);
        assert.deepEqual(page.items[1].transactions, []);
        assert.equal(page.hasMore, true);
        assert.equal(page.cursor, 'next-page');
        assert.ok(urls.includes('/hl/v2/payments?limit=50&startingAfter=previous-page'));
        assert.equal(typeof productionTransaction.extraData, 'string');
    } finally {
        globalThis.fetch = previousFetch;
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
});

test('normalizes documented and production wrapper checkout responses', () => {
    const url = 'https://web.mayar.id/pl/checkout?immutable=signed';
    assert.equal(extractImmutableCheckoutUrl({ data: { checkoutLink: url } }, 'production'), url);
    assert.equal(extractImmutableCheckoutUrl({ data: [{ checkoutLink: url }] }, 'production'), url);
    assert.equal(extractImmutableCheckoutUrl({ data: url }, 'production'), url);
    assert.equal(extractImmutableCheckoutUrl({ data: { checkoutLink: 'https://example.com/phishing?immutable=x' } }, 'production'), null);
    assert.equal(extractImmutableCheckoutUrl({ data: { checkoutLink: 'https://web.mayar.id/pl/checkout' } }, 'production'), null);
});

test('selects the immutable URL for the requested membership tier', () => {
    const basicUrl = 'https://ryaneko.myr.id/m/client-desk-access?immutable=basic';
    const proUrl = 'https://ryaneko.myr.id/m/client-desk-access?immutable=pro';
    const response = { data: { membershipTiers: [
        { id: 'pro', specificPaymentLinkUrl: proUrl },
        { id: 'basic', specificPaymentLinkUrl: basicUrl },
    ] } };
    assert.equal(extractImmutableCheckoutUrl(response, 'production', 'basic'), basicUrl);
    assert.equal(extractImmutableCheckoutUrl(response, 'production', 'missing'), null);
});

test('generates an immutable hosted checkout with trusted customer data', async () => {
    const previousKey = process.env.MAYAR_API_KEY;
    const previousEnv = process.env.MAYAR_ENV;
    const previousFetch = globalThis.fetch;
    process.env.MAYAR_API_KEY = 'test-key';
    process.env.MAYAR_ENV = 'sandbox';
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return new Response(JSON.stringify({
            statusCode: 200,
            message: 'success',
            data: { checkoutLink: 'https://web.mayar.io/pl/checkout?immutable=signed' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
        const checkoutUrl = await generateImmutableCheckout({
            productId: 'product-1',
            membershipTierId: 'tier-1',
            customerInfo: { name: 'Budi', email: 'budi@example.com', mobile: '+628123456789' },
            creditAmount: 49_000,
        });
        assert.equal(checkoutUrl, 'https://web.mayar.io/pl/checkout?immutable=signed');
        assert.equal(capturedUrl, 'https://api.mayar.io/credit/v2/credit/generate/immutable/checkout');
        assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
            productId: 'product-1',
            customerInfo: { name: 'Budi', email: 'budi@example.com', mobile: '+628123456789' },
            creditAmount: 49_000,
        });
        assert.equal(new Headers(capturedInit?.headers).get('authorization'), 'Bearer test-key');
    } finally {
        globalThis.fetch = previousFetch;
        if (previousKey === undefined) delete process.env.MAYAR_API_KEY;
        else process.env.MAYAR_API_KEY = previousKey;
        if (previousEnv === undefined) delete process.env.MAYAR_ENV;
        else process.env.MAYAR_ENV = previousEnv;
    }
});

test('rejects a checkout URL outside the selected Mayar environment', async () => {
    const previousKey = process.env.MAYAR_API_KEY;
    const previousEnv = process.env.MAYAR_ENV;
    const previousFetch = globalThis.fetch;
    process.env.MAYAR_API_KEY = 'test-key';
    process.env.MAYAR_ENV = 'sandbox';
    globalThis.fetch = async () => new Response(JSON.stringify({
        statusCode: 200,
        data: { checkoutLink: 'https://example.com/phishing' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    try {
        await assert.rejects(() => generateImmutableCheckout({
            productId: 'product-1',
            membershipTierId: 'tier-1',
            customerInfo: { name: 'Budi', email: 'budi@example.com', mobile: '+628123456789' },
            creditAmount: 49_000,
        }), /unrecognized checkout response/);
    } finally {
        globalThis.fetch = previousFetch;
        if (previousKey === undefined) delete process.env.MAYAR_API_KEY;
        else process.env.MAYAR_API_KEY = previousKey;
        if (previousEnv === undefined) delete process.env.MAYAR_ENV;
        else process.env.MAYAR_ENV = previousEnv;
    }
});
