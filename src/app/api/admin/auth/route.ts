import { NextRequest, NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    adminSessionCookieOptions,
    createAdminSessionValue,
    isAdminPasswordConfigured,
    verifyAdminPassword,
} from '@/lib/admin-session';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!isAdminPasswordConfigured()) {
            return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
        }
        if (!verifyAdminPassword(body?.password)) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        const response = NextResponse.json({ success: true });
        response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(), adminSessionCookieOptions);
        return response;
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...adminSessionCookieOptions, maxAge: 0 });
    return response;
}
