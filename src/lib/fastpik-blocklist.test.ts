import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    blocklistSearchFilter,
    findActiveFastpikBlock,
    findFastpikUserByEmail,
    isValidBlocklistEmail,
    normalizeBlocklistEmail,
    resolveFastpikBlockedUserId,
} from './fastpik-blocklist.ts';

test('blocklist validates and normalizes email without accepting non-string input', () => {
    assert.equal(normalizeBlocklistEmail('  Person@Example.COM '), 'person@example.com');
    assert.equal(normalizeBlocklistEmail({ email: 'person@example.com' }), '');
    for (const email of ['', 'person', 'person@', 'person @example.com', 'person@@example.com']) assert.equal(isValidBlocklistEmail(email), false);
    assert.equal(isValidBlocklistEmail('person+trial@example.com'), true);
});

test('search quotes PostgREST syntax and escapes pattern wildcards', () => {
    assert.equal(blocklistSearchFilter('person'), 'email.ilike."%person%",reason.ilike."%person%"');
    const search = 'x,y)"%_\\*';
    const pattern = JSON.stringify(`%${search.replace(/[\\%_*]/g, '\\$&')}%`);
    assert.equal(blocklistSearchFilter(search), `email.ilike.${pattern},reason.ilike.${pattern}`);
});

test('auth lookup traverses all pages and compares normalized emails', async () => {
    const pages: number[] = [];
    const supabase = { auth: { admin: { listUsers: async ({ page }: { page: number }) => {
        pages.push(page);
        return { data: { users: page === 1 ? Array.from({ length: 1000 }, (_, i) => ({ id: `other-${i}`, email: `other-${i}@example.com` })) : [{ id: 'target', email: 'Target@Example.com' }] }, error: null };
    } } } } as unknown as SupabaseClient;
    assert.equal((await findFastpikUserByEmail(supabase, ' target@example.com '))?.id, 'target');
    assert.deepEqual(pages, [1, 2]);
});

test('reactivating a block retains its original account after an email change', async () => {
    const supabase = { auth: { admin: { listUsers: () => { throw new Error('Must not rebind an existing account'); } } } } as unknown as SupabaseClient;
    assert.equal(await resolveFastpikBlockedUserId(supabase, 'old@example.com', 'original-user-id'), 'original-user-id');
});

function fakeBlockClient(emailBlocked: boolean, idBlocked: boolean, fails = false) {
    const queries: Record<string, unknown>[] = [];
    const client = {
        from: () => {
            const filters: Record<string, unknown> = {};
            queries.push(filters);
            const builder = {
                select: () => builder,
                eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
                limit: () => builder,
                maybeSingle: async () => ({ data: (filters.email ? emailBlocked : idBlocked) ? { id: 'block' } : null, error: fails ? new Error('Database unavailable') : null }),
            };
            return builder;
        },
        auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 'same-user', email: 'new@example.com' }] }, error: null }) } },
    } as unknown as SupabaseClient;
    return { client, queries };
}

test('trial guard rejects an email block before creating or looking up an account', async () => {
    const { client, queries } = fakeBlockClient(true, false);
    assert.deepEqual(await findActiveFastpikBlock(client, 'NEW@example.com'), { id: 'block' });
    assert.deepEqual(queries, [{ email: 'new@example.com', is_active: true }]);
});

test('trial guard rejects a linked account even if its email has changed', async () => {
    const { client, queries } = fakeBlockClient(false, true);
    assert.deepEqual(await findActiveFastpikBlock(client, 'new@example.com'), { id: 'block' });
    assert.deepEqual(queries[1], { suspended_user_id: 'same-user', is_active: true });
});

test('trial guard permits an unblocked account and fails closed on database errors', async () => {
    assert.equal(await findActiveFastpikBlock(fakeBlockClient(false, false).client, 'new@example.com'), null);
    await assert.rejects(findActiveFastpikBlock(fakeBlockClient(false, false, true).client, 'new@example.com'), /Database unavailable/);
});
