import assert from 'node:assert/strict';
import test from 'node:test';
import { extractImmutableCheckoutUrl, generateImmutableCheckout } from './mayar-v2.ts';

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
