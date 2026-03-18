import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route for Client Desk tenant account assignment API.
 * Forwards requests to Client Desk /api/admin/tenant-accounts with server-side API key.
 */

const CLIENTDESK_API = process.env.CLIENTDESK_API_URL || 'https://clientdesk.ryanekoapp.web.id';
const CLIENTDESK_KEY = process.env.CLIENTDESK_ADMIN_API_KEY || '';

async function proxyToClientDesk(request: NextRequest, method: string) {
    if (!CLIENTDESK_KEY) {
        return NextResponse.json(
            { error: 'CLIENTDESK_ADMIN_API_KEY not configured on server' },
            { status: 500 }
        );
    }

    try {
        const headers: Record<string, string> = {
            'x-admin-api-key': CLIENTDESK_KEY,
        };

        const init: RequestInit = { method, headers };
        const targetPath = `/api/admin/tenant-accounts${request.nextUrl.search || ''}`;

        if (method !== 'GET') {
            const body = await request.text();
            if (body) {
                headers['Content-Type'] = 'application/json';
                init.body = body;
            }
        }

        const res = await fetch(`${CLIENTDESK_API}${targetPath}`, init);
        const data = await res.json();

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Vendor Client Desk accounts proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to Client Desk API' },
            { status: 502 }
        );
    }
}

export async function GET(request: NextRequest) {
    return proxyToClientDesk(request, 'GET');
}

export async function PUT(request: NextRequest) {
    return proxyToClientDesk(request, 'PUT');
}
