import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BUNDLE_PRICE_CATALOG,
    CLIENT_DESK_PRICE_CATALOG,
    FASTPIK_PRICE_CATALOG,
    detectBundlePlanFromAmount,
    detectClientDeskPlanFromAmount,
    detectFastpikPlanFromAmount,
    mapDurationToFastpikTier,
} from './mayar-subscription-catalog.ts';

test('resolves all active Fastpik prices', () => {
    for (const entry of FASTPIK_PRICE_CATALOG) {
        assert.equal(detectFastpikPlanFromAmount(entry.price), entry.tier);
    }
});

test('resolves all active Client Desk prices with plan and duration', () => {
    for (const entry of CLIENT_DESK_PRICE_CATALOG) {
        assert.deepEqual(detectClientDeskPlanFromAmount(entry.price), entry);
    }
});

test('resolves all active bundle prices and maps Fastpik by duration', () => {
    for (const entry of BUNDLE_PRICE_CATALOG) {
        assert.deepEqual(detectBundlePlanFromAmount(entry.price), entry);
        assert.equal(mapDurationToFastpikTier(entry.duration), `pro_${entry.duration}`);
    }
});

test('honors catalog tolerances at their boundaries', () => {
    assert.equal(detectFastpikPlanFromAmount(28_000), 'pro_monthly');
    assert.equal(detectFastpikPlanFromAmount(30_001), null);
    assert.equal(detectClientDeskPlanFromAmount(48_000)?.tier, 'basic_monthly');
    assert.equal(detectClientDeskPlanFromAmount(50_001), null);
    assert.equal(detectBundlePlanFromAmount(67_000)?.tier, 'basic_monthly');
    assert.equal(detectBundlePlanFromAmount(71_001), null);
});

test('rejects legacy, lifetime, and unknown subscription prices', () => {
    for (const amount of [15_000, 39_000, 105_000, 109_650, 349_000, 389_000, 439_200, 549_000]) {
        assert.equal(detectFastpikPlanFromAmount(amount), null);
        assert.equal(detectClientDeskPlanFromAmount(amount), null);
    }

    for (const amount of [49_000, 129_000, 489_000]) {
        assert.equal(detectBundlePlanFromAmount(amount), null);
    }

    assert.equal(detectBundlePlanFromAmount(749_000, 'Bundling Client Desk & Fastpik Lifetime'), null);
});
