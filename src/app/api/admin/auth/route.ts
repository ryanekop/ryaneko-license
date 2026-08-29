import { NextRequest, NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    getAdminSessionCookieOptions,
    createAdminSessionValue,
    isAdminPasswordConfigured,
    REMEMBERED_ADMIN_SESSION_TTL_SECONDS,
    verifyAdminRequest,
    verifyAdminPassword,
} from '@/lib/admin-session';

export async function GET(request: NextRequest) {
    return NextResponse.json(
        { authenticated: verifyAdminRequest(request) },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!isAdminPasswordConfigured()) {
            return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
        }
        if (!verifyAdminPassword(body?.password)) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        const remember = body?.remember === true;
        const ttlSeconds = remember ? REMEMBERED_ADMIN_SESSION_TTL_SECONDS : undefined;
        const response = NextResponse.json({ success: true });
        response.cookies.set(
            ADMIN_SESSION_COOKIE,
            createAdminSessionValue(ttlSeconds),
            getAdminSessionCookieOptions(remember),
        );
        return response;
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...getAdminSessionCookieOptions(), maxAge: 0 });
    return response;
}
