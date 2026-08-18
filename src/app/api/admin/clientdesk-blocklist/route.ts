import { NextRequest, NextResponse } from 'next/server';
import { createPagination, parseListParams } from '@/lib/pagination';

const CLIENTDESK_API = process.env.CLIENTDESK_API_URL || 'https://clientdesk.id';
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
        const upstreamParams = new URLSearchParams(request.nextUrl.searchParams);
        if (upstreamParams.get('q') && !upstreamParams.get('search')) upstreamParams.set('search', upstreamParams.get('q')!);
        const targetPath = `/api/admin/auth-blocklist${upstreamParams.size ? `?${upstreamParams}` : ''}`;

        if (method !== 'GET') {
            const body = await request.text();
            if (body) {
                headers['Content-Type'] = 'application/json';
                init.body = body;
            }
        }

        const res = await fetch(`${CLIENTDESK_API}${targetPath}`, init);
        const data = await res.json();

        if (method === 'GET' && res.ok && !data.pagination) {
            const { requestedPage, pageSize, q } = parseListParams(request.nextUrl.searchParams);
            const source = Array.isArray(data.items) ? data.items : Array.isArray(data.blocklist) ? data.blocklist : [];
            const normalizedQ = q.toLowerCase();
            const filtered = normalizedQ ? source.filter((item: { email?: string; reason?: string }) =>
                `${item.email || ''} ${item.reason || ''}`.toLowerCase().includes(normalizedQ)) : source;
            const pagination = createPagination(filtered.length, requestedPage, pageSize);
            const offset = (pagination.page - 1) * pagination.pageSize;
            const items = filtered.slice(offset, offset + pagination.pageSize);
            return NextResponse.json({ ...data, success: true, items, blocklist: items, pagination }, { status: res.status });
        }

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Client Desk blocklist proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to Client Desk API' },
            { status: 502 }
        );
    }
}

export async function GET(request: NextRequest) {
    return proxyToClientDesk(request, 'GET');
}

export async function POST(request: NextRequest) {
    return proxyToClientDesk(request, 'POST');
}

export async function PUT(request: NextRequest) {
    return proxyToClientDesk(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
    return proxyToClientDesk(request, 'DELETE');
}
