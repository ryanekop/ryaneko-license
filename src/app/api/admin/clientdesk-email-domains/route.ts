import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const CLIENTDESK_API = process.env.CLIENTDESK_API_URL || 'https://clientdesk.id';
const CLIENTDESK_KEY = process.env.CLIENTDESK_ADMIN_API_KEY || '';

function parseUpstreamPayload(text: string, status: number, ok: boolean) {
    const trimmed = text.trim();
    if (!trimmed) {
        return ok
            ? { success: true }
            : { success: false, error: `Client Desk API request failed with status ${status}` };
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return ok ? { success: true, data: trimmed } : { success: false, error: trimmed };
    }
}

async function proxyToClientDesk(request: NextRequest, method: 'GET' | 'PUT') {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    if (!CLIENTDESK_KEY) {
        return NextResponse.json(
            { success: false, error: 'CLIENTDESK_ADMIN_API_KEY not configured on server' },
            { status: 500 },
        );
    }

    try {
        const headers: Record<string, string> = { 'x-admin-api-key': CLIENTDESK_KEY };
        const init: RequestInit = { method, headers, cache: 'no-store' };
        if (method === 'PUT') {
            headers['Content-Type'] = 'application/json';
            init.body = await request.text();
        }
        const query = method === 'GET' ? request.nextUrl.search : '';
        const response = await fetch(
            `${CLIENTDESK_API.replace(/\/+$/, '')}/api/admin/client-email-domains${query}`,
            init,
        );
        const text = await response.text();
        return NextResponse.json(
            parseUpstreamPayload(text, response.status, response.ok),
            { status: response.status },
        );
    } catch (error) {
        console.error('Client Desk email domains proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to connect to Client Desk API' },
            { status: 502 },
        );
    }
}

export async function GET(request: NextRequest) {
    return proxyToClientDesk(request, 'GET');
}

export async function PUT(request: NextRequest) {
    return proxyToClientDesk(request, 'PUT');
}
