import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as session from './admin-session.ts';
import * as helpers from './fastpik-blocklist.ts';
import * as pagination from './pagination.ts';

type Row = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;
const ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function compile(file: string, imports: Record<string, unknown>) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const exports: Record<string, Handler> = {};
    runInNewContext(js, { exports, console: { error() {} }, require: (name: string) => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
    } });
    return exports;
}

function fixture(initialRows: Row[] = []) {
    const rows = initialRows.map((row) => ({ ...row }));
    let authLookups = 0;
    let databaseRequests = 0;
    const client = {
        auth: { admin: { listUsers: async () => { authLookups += 1; return { data: { users: [{ id: USER_ID, email: 'person@example.com' }] }, error: null }; } } },
        from: () => {
            databaseRequests += 1;
            const filters: Row = {};
            let operation = 'select';
            let values: Row = {};
            let head = false;
            let search = '';
            let range: number[] | null = null;
            const execute = (single = false) => {
                let selected = rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
                if (search) selected = selected.filter((row) => `${row.email} ${row.reason}`.toLowerCase().includes(search));
                if (operation === 'upsert') {
                    let row = rows.find((entry) => entry.email === values.email);
                    if (row) Object.assign(row, values);
                    else { row = { id: ID, ...values }; rows.push(row); }
                    selected = [row];
                } else if (operation === 'update') selected.forEach((row) => Object.assign(row, values));
                else if (operation === 'delete') selected.forEach((row) => rows.splice(rows.indexOf(row), 1));
                const count = selected.length;
                if (range) selected = selected.slice(range[0], range[1] + 1);
                return { data: head ? null : single ? selected[0] || null : selected, count, error: null };
            };
            const builder = {
                select: (_columns?: string, options?: { head?: boolean }) => { head = options?.head || false; return builder; },
                eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
                or: (filter: string) => { search = JSON.parse(filter.slice('email.ilike.'.length).split(',reason.ilike.')[0]).slice(1, -1); return builder; },
                order: () => builder,
                limit: () => builder,
                range: (start: number, end: number) => { range = [start, end]; return builder; },
                upsert: (input: Row) => { operation = 'upsert'; values = input; return builder; },
                update: (input: Row) => { operation = 'update'; values = input; return builder; },
                delete: () => { operation = 'delete'; return builder; },
                single: async () => execute(true),
                maybeSingle: async () => execute(true),
                then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
            };
            return builder;
        },
    };
    const server = { NextResponse: { json: Response.json } };
    const auth = compile('./admin-auth.ts', { 'next/server': server, '@/lib/admin-session': session });
    const route = compile('../app/api/admin/fastpik-blocklist/route.ts', {
        'next/server': server, '@/lib/admin-auth': auth, '@/lib/fastpik-supabase': { getFastpikSupabase: () => client },
        '@/lib/pagination': pagination, '@/lib/fastpik-blocklist': helpers,
    });
    function request(method: string, body?: unknown, options: { authenticated?: boolean; origin?: string; query?: string } = {}) {
        const req = new Request(`https://license.example/api/admin/fastpik-blocklist${options.query || ''}`, {
            method, headers: { origin: options.origin || 'https://license.example', 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        Object.defineProperties(req, {
            nextUrl: { value: new URL(req.url) },
            cookies: { value: { get: () => options.authenticated === false ? undefined : { value: session.createAdminSessionValue() } } },
        });
        return req;
    }
    return { rows, route, request, counts: () => ({ authLookups, databaseRequests }) };
}

test('all blocklist methods require an authenticated same-origin admin before database access', async () => {
    process.env.ADMIN_SESSION_SECRET = 'blocklist-route-tests';
    const f = fixture();
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        assert.equal((await f.route[method](f.request(method, undefined, { authenticated: false }))).status, 401);
        assert.equal((await f.route[method](f.request(method, undefined, { origin: 'https://attacker.example' }))).status, 403);
    }
    assert.equal(f.counts().databaseRequests, 0);
});

test('POST validates, normalizes and reactivates duplicates while retaining an original linked account', async () => {
    process.env.ADMIN_SESSION_SECRET = 'blocklist-route-tests';
    const f = fixture();
    assert.equal((await f.route.POST(f.request('POST', { email: 'invalid' }))).status, 400);
    const response = await f.route.POST(f.request('POST', { email: ' Person@Example.COM ', reason: ' test ' }));
    assert.equal(response.status, 201);
    assert.equal(f.rows[0].email, 'person@example.com');
    assert.equal(f.rows[0].reason, 'test');
    assert.equal(f.rows[0].suspended_user_id, USER_ID);
    f.rows[0].is_active = false;
    f.rows[0].suspended_user_id = 'original-account';
    assert.equal((await f.route.POST(f.request('POST', { email: 'person@example.com' }))).status, 201);
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0].is_active, true);
    assert.equal(f.rows[0].suspended_user_id, 'original-account');
    assert.equal(f.counts().authLookups, 1);
});

test('GET searches email/reason and clamps pagination; PUT toggles and DELETE removes only the rule', async () => {
    process.env.ADMIN_SESSION_SECRET = 'blocklist-route-tests';
    const f = fixture([{ id: ID, email: 'person@example.com', reason: 'review', is_active: true, suspended_user_id: USER_ID }]);
    const response = await f.route.GET(f.request('GET', undefined, { query: '?q=review&page=99&pageSize=10' }));
    const data = await response.json();
    assert.equal(data.items.length, 1);
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.total, 1);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await f.route.PUT(f.request('PUT', { id: ID, is_active: false }))).status, 200);
    assert.equal(f.rows[0].is_active, false);
    assert.equal((await f.route.PUT(f.request('PUT', { id: ID, is_active: true }))).status, 200);
    assert.equal(f.rows[0].is_active, true);
    assert.equal((await f.route.DELETE(f.request('DELETE', { id: ID }))).status, 200);
    assert.equal(f.rows.length, 0);
    assert.equal((await f.route.DELETE(f.request('DELETE', { id: ID }))).status, 404);
});
