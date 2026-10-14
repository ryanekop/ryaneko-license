import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoftwarePurchaseFeed, maskSoftwareBuyer, RAW_MAYAR_PRODUCT_ID } from './software-purchase-feed.ts';
import { listMayarProductTransactions, type MayarProductTransaction } from './mayar-v2.ts';

const buyer = { name: 'Made Buyer', email: 'bagus@gmail.com' };
const row = (id: string, status = 'settled', createdAt = 1000): MayarProductTransaction => ({
    id, status, createdAt, paymentLinkId: RAW_MAYAR_PRODUCT_ID, amount: 109000, customer: buyer,
});

test('masks short names and custom email domains without disclosing full identifiers', () => {
    assert.deepEqual(maskSoftwareBuyer(buyer.name, buyer.email), { name: 'Mad***', email: 'bag***@gmail.com' });
    assert.deepEqual(maskSoftwareBuyer('Al', 'ab@private-company.test'), { name: 'A***', email: 'a***@***' });
    assert.deepEqual(maskSoftwareBuyer('A', 'a@gmail.com'), { name: '***', email: '***@gmail.com' });
});

test('paginates successful states, excludes other products and invalid payments, masks and deduplicates latest twenty', async () => {
    const cursors: Array<string | undefined> = [];
    const getFeed = createSoftwarePurchaseFeed({ now: () => 100000, secret: () => 'test-secret', loadPage: async cursor => {
        cursors.push(cursor);
        return cursor ? { items: Array.from({ length: 22 }, (_, i) => row(`new-${i}`, i % 2 ? 'paid' : 'settled', 2000 + i)), hasMore: false, cursor: null } : {
            items: [row('old'), row('old'), row('unpaid', 'unpaid'), row('refunded', 'refunded'),
                { ...row('other'), paymentLinkId: 'other-product' }, { ...row('zero'), amount: 0 },
                { ...row('bad-customer'), customer: { name: 'Buyer', email: 'invalid' } }, row('future', 'paid', 200000)],
            hasMore: true, cursor: 'page-two',
        };
    } });
    const feed = await getFeed();
    assert.deepEqual(cursors, [undefined, 'page-two']);
    assert.equal(feed.purchases.length, 20);
    assert.equal(new Set(feed.purchases.map(item => item.id)).size, 20);
    assert.ok(feed.purchases.every(item => /^[a-f0-9]{32}$/.test(item.id) && item.amount === 109000));
    const serialized = JSON.stringify(feed);
    for (const privateValue of ['Made Buyer', 'bagus@gmail.com', 'new-21', RAW_MAYAR_PRODUCT_ID]) assert.ok(!serialized.includes(privateValue));
});

test('single-flight hourly cache retains stale masked feed and backs off on failures', async () => {
    let clock = 100000;
    let calls = 0;
    let fail = false;
    const getFeed = createSoftwarePurchaseFeed({ now: () => clock, secret: () => 'secret', loadPage: async () => {
        calls++;
        await Promise.resolve();
        if (fail) throw new Error('private provider information');
        return { items: [row('one')], hasMore: false, cursor: null };
    } });
    const [a, b] = await Promise.all([getFeed(), getFeed()]);
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
    await getFeed();
    assert.equal(calls, 1);
    clock += 3600000;
    fail = true;
    const stale = await getFeed();
    assert.deepEqual(stale.purchases, a.purchases);
    assert.equal(stale.refreshedAt, a.refreshedAt);
    assert.equal(Date.parse(stale.refreshAfter), clock + 3600000);
    await getFeed();
    assert.equal(calls, 2);
});

test('cold failures return empty feed and repeated cursor fails closed', async () => {
    const cold = createSoftwarePurchaseFeed({ now: () => 100000, secret: () => 'secret', loadPage: async () => { throw new Error('failure'); } });
    assert.deepEqual(await cold(), { purchases: [], refreshedAt: null, refreshAfter: new Date(3700000).toISOString() });
    let calls = 0;
    const repeated = createSoftwarePurchaseFeed({ now: () => 100000, secret: () => 'secret', loadPage: async () => {
        calls++;
        return { items: [row('one')], hasMore: true, cursor: 'repeat' };
    } });
    assert.equal((await repeated()).purchases.length, 0);
    assert.equal(calls, 2);
});

test('Mayar product API uses limit50 startingAfter without excluding settled payments', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.MAYAR_API_KEY;
    process.env.MAYAR_API_KEY = 'test-key';
    globalThis.fetch = async input => {
        const url = new URL(String(input));
        assert.equal(url.pathname, `/hl/v2/products/${RAW_MAYAR_PRODUCT_ID}/transactions`);
        assert.equal(url.searchParams.get('limit'), '50');
        assert.equal(url.searchParams.get('startingAfter'), 'older');
        assert.equal(url.searchParams.has('status'), false);
        return Response.json({ data: [row('one')], hasMore: true, nextStartingAfter: 'next' });
    };
    try { assert.equal((await listMayarProductTransactions(RAW_MAYAR_PRODUCT_ID, 'older')).cursor, 'next'); }
    finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.MAYAR_API_KEY;
        else process.env.MAYAR_API_KEY = originalKey;
    }
});
