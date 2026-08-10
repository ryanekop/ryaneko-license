import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'rl_admin_session';
export const LEGACY_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
export const LEGACY_ADMIN_EMAIL = 'legacy-admin';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

function getSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function digest(value: string) {
    return createHash('sha256').update(value).digest();
}

export function isAdminPasswordConfigured() {
    return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(value: unknown) {
    const expected = process.env.ADMIN_PASSWORD;
    if (typeof value !== 'string' || !expected) return false;
    return timingSafeEqual(digest(value), digest(expected));
}

function encodeBase64Url(value: string) {
    return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
    const secret = getSessionSecret();
    if (!secret) return '';
    return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a: string, b: string) {
    return timingSafeEqual(digest(a), digest(b));
}

export function createAdminSessionValue() {
    const now = Math.floor(Date.now() / 1000);
    const payload = encodeBase64Url(JSON.stringify({ iat: now, exp: now + SESSION_TTL_SECONDS }));
    return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionValue(value: string | undefined) {
    if (!value) return false;
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return false;

    const expectedSignature = sign(payload);
    if (!expectedSignature || !safeEqual(signature, expectedSignature)) return false;

    try {
        const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
        return typeof parsed.exp === 'number' && parsed.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

export function verifyAdminRequest(request: NextRequest) {
    return verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function verifyAdminHeader(request: NextRequest | Request) {
    const authorization = request.headers.get('authorization') || '';
    const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
    return verifyAdminPassword(request.headers.get('x-admin-password')) || verifyAdminPassword(bearer);
}

function firstHeaderValue(value: string | null) {
    return value?.split(',')[0]?.trim() || '';
}

function getPublicRequestOrigin(request: NextRequest) {
    const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'));
    const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host')) || firstHeaderValue(request.headers.get('host'));
    if (forwardedHost) {
        const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
        return `${protocol}://${forwardedHost}`;
    }
    return request.nextUrl.origin;
}

export function isSameOriginRequest(request: NextRequest) {
    const requestOrigin = getPublicRequestOrigin(request);
    const origin = request.headers.get('origin');
    if (origin && origin !== requestOrigin) return false;

    const referer = request.headers.get('referer');
    if (!referer) return true;
    try {
        return new URL(referer).origin === requestOrigin;
    } catch {
        return false;
    }
}

export const adminSessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
};
