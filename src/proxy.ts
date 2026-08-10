import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export default async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === '/api/admin/auth') return NextResponse.next();
    const auth = requireAdmin(request, {
        allowPasswordHeader: request.nextUrl.pathname === '/api/admin/mayar/clientdesk-backfill',
    });
    return auth.ok ? NextResponse.next() : auth.response;
}

export const config = { matcher: ['/api/admin/:path*'] };
