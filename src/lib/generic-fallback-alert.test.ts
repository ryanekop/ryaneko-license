import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { notifyGenericFallbackOnce } from './generic-fallback-alert.ts';

function fixture(mode: 'ok' | 'db-error' | 'send-false' | 'send-throw' = 'ok') {
    const claimed = new Set<string>();
    const sent: string[] = [];
    const errors: string[] = [];
    const db = createClient('https://license.example.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (input, init) => {
                const url = new URL(String(input));
                assert.equal(url.pathname, '/rest/v1/licenses');
                assert.equal(init?.method, 'PATCH');
                assert.equal(url.searchParams.get('generic_fallback_alert_claimed_at'), 'is.null');
                assert.equal(url.searchParams.get('select'), 'id');
                const body = JSON.parse(String(init?.body));
                assert.deepEqual(Object.keys(body), ['generic_fallback_alert_claimed_at']);
                assert.ok(Number.isFinite(Date.parse(body.generic_fallback_alert_claimed_at)));
                const id = url.searchParams.get('id')?.replace(/^eq\./, '');
                assert.ok(id);
                if (mode === 'db-error') {
                    return Response.json({ code: '42703', message: 'Missing column' }, { status: 400 });
                }
                // Model the database's conditional UPDATE, with no read-then-write gap.
                const rows = claimed.has(id) ? [] : [{ id }];
                claimed.add(id);
                return Response.json(rows);
            },
        },
    });
    const dependencies = {
        db,
        send: async (message: string) => {
            sent.push(message);
            if (mode === 'send-throw') throw new Error('Telegram unreachable');
            return mode !== 'send-false';
        },
        logError: (message: string) => { errors.push(message); },
    };
    return { claimed, sent, errors, dependencies };
}

test('activation and verification share a lifetime claim; different licenses alert independently', async () => {
    const { dependencies, sent, errors } = fixture();
    await notifyGenericFallbackOnce('license-a', 'activate', dependencies);
    await notifyGenericFallbackOnce('license-a', 'verify', dependencies);
    await notifyGenericFallbackOnce('license-b', 'verify', dependencies);
    assert.deepEqual(sent, ['activate', 'verify']);
    assert.deepEqual(errors, []);
});

test('concurrent fallback requests send only once', async () => {
    const { dependencies, sent, errors } = fixture();
    await Promise.all(Array.from({ length: 20 }, (_, i) =>
        notifyGenericFallbackOnce('license-a', i % 2 ? 'verify' : 'activate', dependencies)
    ));
    assert.equal(sent.length, 1);
    assert.deepEqual(errors, []);
});

test('database failure skips Telegram without rejecting the request', async () => {
    const { dependencies, sent, errors } = fixture('db-error');
    await assert.doesNotReject(notifyGenericFallbackOnce('license-a', 'verify', dependencies));
    assert.deepEqual(sent, []);
    assert.equal(errors.length, 1);
});

test('thrown database failure is contained', async () => {
    const { dependencies, sent, errors } = fixture();
    dependencies.db.from = () => { throw new Error('Database unavailable'); };
    await assert.doesNotReject(notifyGenericFallbackOnce('license-a', 'verify', dependencies));
    assert.deepEqual(sent, []);
    assert.equal(errors.length, 1);
});

for (const mode of ['send-false', 'send-throw'] as const) {
    test(`${mode} retains the claim and prevents automatic retries`, async () => {
        const { dependencies, claimed, sent, errors } = fixture(mode);
        await assert.doesNotReject(notifyGenericFallbackOnce('license-a', 'activate', dependencies));
        await notifyGenericFallbackOnce('license-a', 'verify', dependencies);
        assert.ok(claimed.has('license-a'));
        assert.equal(sent.length, 1);
        assert.equal(errors.length, 1);
    });
}

test('both fallback routes use the shared helper and retain their audit logging and binding', () => {
    for (const action of ['activate', 'verify']) {
        const source = readFileSync(new URL(`../app/api/license/${action}/route.ts`, import.meta.url), 'utf8');
        const branch = source.split("if (bindingResolution === 'generic-fallback') {")[1]
            .split('return NextResponse.json')[0];
        assert.match(branch, /notifyGenericFallbackOnce\(\s*licenseData.id,/);
        assert.match(branch, /Generic Windows fallback accepted; retained binding:/);
        assert.match(branch, /await log(?:Activation|Verification)\(/);
        assert.match(branch, /\.update\(\{ last_active_at: now \}\)/);
        assert.doesNotMatch(branch, /await notifyAlert\(/);
    }
});
