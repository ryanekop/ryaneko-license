import { NextRequest, NextResponse } from 'next/server';
import { createPagination, parseListParams } from '@/lib/pagination';
import { parseVendorSortMode, sortVendors, type SortableVendor } from '@/lib/vendor-sort';

/**
 * Proxy route for Client Desk tenant management API.
 * Forwards requests to Client Desk /api/admin/tenants with server-side API key.
 */

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
        return ok
            ? { success: true, data: trimmed }
            : { success: false, error: trimmed };
    }
}

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

        if (method !== 'GET') {
            const body = await request.text();
            if (body) {
                headers['Content-Type'] = 'application/json';
                init.body = body;
            }
        }

        const sort = parseVendorSortMode(request.nextUrl.searchParams.get('sort'));
        const upstreamParams = new URLSearchParams(request.nextUrl.searchParams);
        upstreamParams.set('sort', sort);
        const query = method === 'GET' ? `?${upstreamParams.toString()}` : '';
        const res = await fetch(`${CLIENTDESK_API}/api/admin/tenants${query}`, init);
        const text = await res.text();
        const data = parseUpstreamPayload(text, res.status, res.ok);

        if (method === 'GET' && res.ok && Array.isArray(data)) {
            const { requestedPage, pageSize, q } = parseListParams(request.nextUrl.searchParams);
            const needle = q.toLowerCase();
            const filtered = needle ? data.filter((tenant: SortableVendor & { slug?: string; domain?: string }) =>
                `${tenant.name || ''} ${tenant.slug || ''} ${tenant.domain || ''}`.toLowerCase().includes(needle)) : data;
            const sorted = sortVendors(filtered, sort);
            const pagination = createPagination(filtered.length, requestedPage, pageSize);
            const offset = (pagination.page - 1) * pagination.pageSize;
            return NextResponse.json({ items: sorted.slice(offset, offset + pagination.pageSize), pagination }, { status: res.status });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Vendor Client Desk proxy error:', error);
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
