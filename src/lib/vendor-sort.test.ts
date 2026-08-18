import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVendorSortMode, sortVendors } from './vendor-sort.ts';

const vendors = [
    { id: 'b', name: 'Zulu', created_at: '2026-01-02T00:00:00.000Z' },
    { id: 'c', name: 'Alpha', created_at: '2026-01-03T00:00:00.000Z' },
    { id: 'a', name: 'Beta', created_at: '2026-01-02T00:00:00.000Z' },
];

test('parses supported vendor sort modes and defaults invalid values to newest', () => {
    assert.equal(parseVendorSortMode('oldest'), 'oldest');
    assert.equal(parseVendorSortMode('alphabetical'), 'alphabetical');
    assert.equal(parseVendorSortMode('invalid'), 'newest');
    assert.equal(parseVendorSortMode(null), 'newest');
});

test('sorts vendors newest first with deterministic name and id tie-breakers', () => {
    assert.deepEqual(sortVendors(vendors, 'newest').map((vendor) => vendor.id), ['c', 'a', 'b']);
});

test('sorts vendors oldest first', () => {
    assert.deepEqual(sortVendors(vendors, 'oldest').map((vendor) => vendor.id), ['a', 'b', 'c']);
});

test('sorts vendors alphabetically from A to Z', () => {
    assert.deepEqual(sortVendors(vendors, 'alphabetical').map((vendor) => vendor.id), ['c', 'a', 'b']);
});

test('uses id as final tie-breaker and does not mutate the source array', () => {
    const tied = [
        { id: '2', name: 'Same', created_at: '2026-01-01T00:00:00.000Z' },
        { id: '1', name: 'Same', created_at: '2026-01-01T00:00:00.000Z' },
    ];

    assert.deepEqual(sortVendors(tied, 'newest').map((vendor) => vendor.id), ['1', '2']);
    assert.deepEqual(tied.map((vendor) => vendor.id), ['2', '1']);
});
