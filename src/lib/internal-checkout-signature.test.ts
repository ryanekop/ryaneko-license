import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyCheckoutServiceSignature } from './internal-checkout-signature.ts';

test('verifies a current signed checkout request and rejects tampering', () => {
    const previous = process.env.RYANEKO_LICENSE_SERVICE_SECRET;
    process.env.RYANEKO_LICENSE_SERVICE_SECRET = 'test-secret';
    const now = Date.parse('2026-09-12T12:00:00.000Z');
    const timestamp = String(now);
    const path = '/api/internal/mayar/immutable-checkout';
    const body = '{"offer":"standalone"}';
    const signature = createHmac('sha256', 'test-secret')
        .update(`${timestamp}.POST.${path}.${body}`)
        .digest('hex');
    assert.equal(verifyCheckoutServiceSignature({ body, method: 'POST', path, timestamp, signature, now }), true);
    assert.equal(verifyCheckoutServiceSignature({ body: `${body}x`, method: 'POST', path, timestamp, signature, now }), false);
    if (previous === undefined) delete process.env.RYANEKO_LICENSE_SERVICE_SECRET;
    else process.env.RYANEKO_LICENSE_SERVICE_SECRET = previous;
});
