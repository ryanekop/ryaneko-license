import { NextRequest, NextResponse } from 'next/server';
import {
    isSameOriginRequest,
    LEGACY_ADMIN_EMAIL,
    LEGACY_ADMIN_ID,
    verifyAdminHeader,
    verifyAdminRequest,
} from '@/lib/admin-session';

export function requireAdmin(request: NextRequest, options: { allowPasswordHeader?: boolean } = {}) {
    const authenticated = verifyAdminRequest(request) || (options.allowPasswordHeader === true && verifyAdminHeader(request));
    if (!authenticated) {
        return { ok: false as const, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    }
    if (!isSameOriginRequest(request) && !(options.allowPasswordHeader === true && verifyAdminHeader(request))) {
        return { ok: false as const, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
    }
    return {
        ok: true as const,
        context: { user: { id: LEGACY_ADMIN_ID, email: LEGACY_ADMIN_EMAIL } },
    };
}
