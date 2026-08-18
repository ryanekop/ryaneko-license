import assert from 'node:assert/strict';
import test from 'node:test';
import { createPagination, parseListParams, parsePageSize, parsePositiveInteger } from './pagination.ts';

test('pagination parsers use safe defaults', () => {
    assert.equal(parsePositiveInteger('-2', 1), 1);
    assert.equal(parsePositiveInteger('abc', 3), 3);
    assert.equal(parsePageSize('11'), 25);
    assert.equal(parsePageSize('50'), 50);
});

test('list params accept legacy search and limit names', () => {
    assert.deepEqual(parseListParams(new URLSearchParams('page=2&limit=10&search=%20eko%20')), {
        requestedPage: 2,
        pageSize: 10,
        q: 'eko',
    });
});

test('pagination clamps an out-of-range page', () => {
    assert.deepEqual(createPagination(26, 9, 25), {
        page: 2,
        pageSize: 25,
        total: 26,
        totalPages: 2,
    });
    assert.equal(createPagination(0, 2, 25).page, 1);
});
