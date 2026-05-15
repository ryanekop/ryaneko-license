import { NextRequest, NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    adminSessionCookieOptions,
    createAdminSessionValue,
} from '@/lib/admin-session';

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
        }

        if (password === adminPassword) {
            const response = NextResponse.json({ success: true });
            response.cookies.set(
                ADMIN_SESSION_COOKIE,
                createAdminSessionValue(),
                adminSessionCookieOptions,
            );
            return response;
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, '', {
        ...adminSessionCookieOptions,
        maxAge: 0,
    });
    return response;
}
