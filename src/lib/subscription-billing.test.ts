import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateImmediateSubscriptionPeriod,
    calculateRemainingCredit,
    calculateScheduledSubscriptionPeriod,
    classifyClientDeskChange,
    createFallbackValuation,
    getClientDeskTierPrice,
    getTierDurationMs,
} from './subscription-billing.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T00:00:00.000Z');

test('converts half of Basic monthly into Plus monthly bonus time', () => {
    const valuation = {
        value: 49_000,
        startsAt: '2026-05-31T00:00:00.000Z',
        endsAt: '2026-06-30T00:00:00.000Z',
        priceSource: 'standalone' as const,
    };
    const period = calculateImmediateSubscriptionPeriod({
        kind: 'upgrade',
        nextTier: 'plus_monthly',
        priceSource: 'standalone',
        existingEndDate: valuation.endsAt,
        existingValuation: valuation,
        now: NOW,
    });

    assert.equal(period.remainingCredit, 24_500);
    assert.equal(period.bonusDurationMs, Math.round((24_500 / 149_000) * (30 * DAY_MS)));
    assert.equal(new Date(period.endDate).getTime(), NOW.getTime() + 30 * DAY_MS + period.bonusDurationMs);
});

test('uses Pro yearly rate when upgrading Basic monthly to Pro yearly', () => {
    const valuation = createFallbackValuation({
        tier: 'basic_monthly',
        endDate: '2026-06-30T00:00:00.000Z',
    });
    const period = calculateImmediateSubscriptionPeriod({
        kind: 'upgrade',
        nextTier: 'pro_yearly',
        priceSource: 'standalone',
        existingEndDate: valuation.endsAt,
        existingValuation: valuation,
        now: NOW,
    });

    assert.equal(period.remainingCredit, 24_500);
    assert.equal(period.bonusDurationMs, Math.round((24_500 / 2_489_000) * (365 * DAY_MS)));
});

test('values remaining Basic yearly time from the yearly catalog price', () => {
    const valuation = createFallbackValuation({
        tier: 'basic_yearly',
        endDate: '2026-12-17T00:00:00.000Z',
    });
    const credit = calculateRemainingCredit(valuation, NOW);

    assert.equal(credit, 489_000 * (185 / 365));
});

test('same-plan duration change extends the active end without a conversion bonus', () => {
    const valuation = {
        value: 74_500,
        startsAt: NOW.toISOString(),
        endsAt: '2026-06-30T00:00:00.000Z',
        priceSource: 'standalone' as const,
    };
    const period = calculateImmediateSubscriptionPeriod({
        kind: 'renewal',
        nextTier: 'plus_yearly',
        priceSource: 'standalone',
        existingEndDate: valuation.endsAt,
        existingValuation: valuation,
        now: NOW,
    });

    assert.equal(period.bonusDurationMs, 0);
    assert.equal(
        new Date(period.endDate).getTime(),
        new Date(valuation.endsAt).getTime() + getTierDurationMs('plus_yearly'),
    );
    assert.equal(period.entitlementValue, 74_500 + 1_489_000);
});

test('downgrade starts after the queued entitlement tail', () => {
    const period = calculateScheduledSubscriptionPeriod({
        nextTier: 'basic_monthly',
        priceSource: 'standalone',
        queueAfter: '2026-08-01T00:00:00.000Z',
    });

    assert.equal(period.startDate, '2026-08-01T00:00:00.000Z');
    assert.equal(period.endDate, '2026-08-31T00:00:00.000Z');
});

test('classifies plan changes by plan rank and ignores duration for renewal', () => {
    assert.equal(classifyClientDeskChange('basic_monthly', 'plus_monthly', true), 'upgrade');
    assert.equal(classifyClientDeskChange('basic_monthly', 'pro_yearly', true), 'upgrade');
    assert.equal(classifyClientDeskChange('plus_monthly', 'plus_yearly', true), 'renewal');
    assert.equal(classifyClientDeskChange('pro_yearly', 'basic_monthly', true), 'downgrade');
    assert.equal(classifyClientDeskChange('free', 'basic_monthly', false), 'purchase');
});

test('derives bundle Client Desk component price separately from Fastpik', () => {
    assert.equal(getClientDeskTierPrice('basic_monthly', 'bundle'), 40_000);
    assert.equal(getClientDeskTierPrice('plus_monthly', 'bundle'), 140_000);
    assert.equal(getClientDeskTierPrice('pro_yearly', 'bundle'), 2_400_000);
});
