import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ADMIN_SESSION_TTL_SECONDS,
    REMEMBERED_ADMIN_SESSION_TTL_SECONDS,
    createAdminSessionValue,
    getAdminSessionCookieOptions,
    verifyAdminSessionValue,
} from './admin-session.ts';

function decodePayload(sessionValue: string) {
    const [payload] = sessionValue.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat: number; exp: number };
}

test('creates a regular admin session with a 12 hour signed lifetime', () => {
    const previousSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = 'admin-session-test-secret';
    try {
        const value = createAdminSessionValue();
        const payload = decodePayload(value);
        assert.equal(payload.exp - payload.iat, ADMIN_SESSION_TTL_SECONDS);
        assert.equal(verifyAdminSessionValue(value), true);
        assert.equal('maxAge' in getAdminSessionCookieOptions(false), false);
    } finally {
        if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
        else process.env.ADMIN_SESSION_SECRET = previousSecret;
    }
});

test('creates a remembered admin session and persistent cookie for 30 days', () => {
    const previousSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = 'admin-session-test-secret';
    try {
        const value = createAdminSessionValue(REMEMBERED_ADMIN_SESSION_TTL_SECONDS);
        const payload = decodePayload(value);
        assert.equal(payload.exp - payload.iat, REMEMBERED_ADMIN_SESSION_TTL_SECONDS);
        assert.equal(getAdminSessionCookieOptions(true).maxAge, REMEMBERED_ADMIN_SESSION_TTL_SECONDS);
    } finally {
        if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
        else process.env.ADMIN_SESSION_SECRET = previousSecret;
    }
});

test('rejects an expired admin session', () => {
    const previousSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = 'admin-session-test-secret';
    try {
        assert.equal(verifyAdminSessionValue(createAdminSessionValue(-1)), false);
    } finally {
        if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
        else process.env.ADMIN_SESSION_SECRET = previousSecret;
    }
});
