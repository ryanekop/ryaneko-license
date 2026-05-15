import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'rl_admin_session';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

function getSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
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
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function createAdminSessionValue() {
    const now = Math.floor(Date.now() / 1000);
    const payload = encodeBase64Url(
        JSON.stringify({
            iat: now,
            exp: now + SESSION_TTL_SECONDS,
        }),
    );
    const signature = sign(payload);
    return `${payload}.${signature}`;
}

export function verifyAdminSessionValue(value: string | undefined) {
    if (!value) return false;
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return false;

    const expectedSignature = sign(payload);
    if (!expectedSignature || !safeEqual(signature, expectedSignature)) {
        return false;
    }

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

export function isSameOriginRequest(request: NextRequest) {
    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get('origin');
    if (origin && origin !== requestOrigin) return false;

    const referer = request.headers.get('referer');
    if (referer) {
        try {
            return new URL(referer).origin === requestOrigin;
        } catch {
            return false;
        }
    }

    return true;
}

export const adminSessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
};
