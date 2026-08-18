import assert from 'node:assert/strict';
import test from 'node:test';
import { createVendorListResult, fetchAllVendorPages } from './vendor-list.ts';

type Vendor = {
    id: string;
    name: string;
    slug: string;
    domain: string;
    created_at: string;
};

function vendor(index: number, overrides: Partial<Vendor> = {}): Vendor {
    return {
        id: String(index).padStart(3, '0'),
        name: `Vendor ${String(index).padStart(2, '0')}`,
        slug: `vendor-${index}`,
        domain: `vendor-${index}.example.com`,
        created_at: new Date(Date.UTC(2026, 0, index)).toISOString(),
        ...overrides,
    };
}

test('accepts the legacy upstream array response without requesting another page', async () => {
    const calls: number[] = [];
    const items = [vendor(1), vendor(2)];
    const result = await fetchAllVendorPages(async (page) => {
        calls.push(page);
        return items;
    });

    assert.deepEqual(result, items);
    assert.deepEqual(calls, [1]);
});

test('collects every page from an upstream paginated response', async () => {
    const pages = [[vendor(1), vendor(2)], [vendor(3)]];
    const result = await fetchAllVendorPages(async (page) => ({
        items: pages[page - 1],
        pagination: { page, totalPages: 2 },
    }), 2);

    assert.deepEqual(result.map((item) => item.id), ['001', '002', '003']);
});

test('continues until an empty page when pagination metadata is missing', async () => {
    const pages = [[vendor(1), vendor(2)], [vendor(3)], []];
    const calls: number[] = [];
    const result = await fetchAllVendorPages(async (page) => {
        calls.push(page);
        return { items: pages[page - 1] };
    }, 2);

    assert.deepEqual(result.map((item) => item.id), ['001', '002', '003']);
    assert.deepEqual(calls, [1, 2, 3]);
});

test('rejects malformed, repeated, partial, and failed upstream pagination', async () => {
    await assert.rejects(() => fetchAllVendorPages(async () => ({ data: [] })));
    await assert.rejects(() => fetchAllVendorPages(async () => ({
        items: [vendor(1)],
        pagination: { totalPages: 2 },
    }), 1), /repeated an item/);
    await assert.rejects(() => fetchAllVendorPages(async (page) => ({
        items: page === 1 ? [vendor(1)] : [],
        pagination: { totalPages: 3 },
    }), 1), /ended early/);
    await assert.rejects(() => fetchAllVendorPages(async (page) => {
        if (page === 2) throw new Error('upstream failed');
        return { items: [vendor(1)], pagination: { totalPages: 2 } };
    }, 1), /upstream failed/);
});

test('filters and sorts globally before applying pagination', () => {
    const vendors = Array.from({ length: 30 }, (_, index) => vendor(30 - index, {
        name: `${index % 2 === 0 ? 'Match' : 'Other'} ${String(30 - index).padStart(2, '0')}`,
    }));

    const result = createVendorListResult(vendors, {
        requestedPage: 2,
        pageSize: 10,
        q: 'match',
        sort: 'alphabetical',
    });

    assert.equal(result.pagination.total, 15);
    assert.equal(result.pagination.page, 2);
    assert.deepEqual(result.items.map((item) => item.name), [
        'Match 22', 'Match 24', 'Match 26', 'Match 28', 'Match 30',
    ]);
});

test('clamps an out-of-range page after filtering', () => {
    const result = createVendorListResult([vendor(1), vendor(2)], {
        requestedPage: 9,
        pageSize: 10,
        q: 'vendor',
        sort: 'newest',
    });

    assert.equal(result.pagination.page, 1);
    assert.deepEqual(result.items.map((item) => item.id), ['002', '001']);
});
