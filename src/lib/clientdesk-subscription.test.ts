import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getClientDeskTierMetadata,
    getClientDeskTierPeriod,
    isClientDeskLifetimeTier,
    normalizeClientDeskTier,
    parseClientDeskTier,
    resolveClientDeskDuration,
    resolveClientDeskPlan,
} from './clientdesk-subscription.ts';

test('parses every canonical Lifetime tier and normalizes the legacy alias', () => {
    assert.equal(parseClientDeskTier('basic_lifetime'), 'basic_lifetime');
    assert.equal(parseClientDeskTier('plus_lifetime'), 'plus_lifetime');
    assert.equal(parseClientDeskTier('pro_lifetime'), 'pro_lifetime');
    assert.equal(parseClientDeskTier('lifetime'), 'basic_lifetime');
    assert.equal(parseClientDeskTier('enterprise_lifetime'), null);
});

test('resolves plan and duration from canonical columns before tier fallbacks', () => {
    assert.equal(resolveClientDeskPlan({ tier: 'plus_lifetime' }), 'plus');
    assert.equal(resolveClientDeskDuration({ tier: 'plus_lifetime' }), 'lifetime');
    assert.equal(
        normalizeClientDeskTier({ tier: 'lifetime', plan: 'pro', duration: 'lifetime' }),
        'pro_lifetime',
    );
    assert.deepEqual(getClientDeskTierMetadata('pro_lifetime'), {
        plan: 'pro',
        duration: 'lifetime',
    });
});

test('recognizes legacy and canonical Lifetime tiers', () => {
    assert.equal(isClientDeskLifetimeTier('lifetime'), true);
    assert.equal(isClientDeskLifetimeTier('basic_lifetime'), true);
    assert.equal(isClientDeskLifetimeTier('plus_monthly', 'lifetime'), true);
    assert.equal(isClientDeskLifetimeTier('pro_yearly'), false);
});

test('Lifetime periods never expire while finite and trial periods remain unchanged', () => {
    const now = new Date('2026-08-04T00:00:00.000Z');

    assert.deepEqual(getClientDeskTierPeriod('plus_lifetime', now), {
        startDate: now.toISOString(),
        endDate: null,
        trialEndDate: null,
    });
    assert.equal(getClientDeskTierPeriod('basic_monthly', now).endDate, '2026-09-04T00:00:00.000Z');
    assert.equal(getClientDeskTierPeriod('free', now).trialEndDate, '2026-08-11T00:00:00.000Z');
});
