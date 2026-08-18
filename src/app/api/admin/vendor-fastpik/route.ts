import { NextRequest, NextResponse } from 'next/server';
import { parseListParams } from '@/lib/pagination';
import { createVendorListResult, fetchAllVendorPages, type VendorListItem } from '@/lib/vendor-list';
import { parseVendorSortMode } from '@/lib/vendor-sort';

/**
 * Proxy route for FastPik tenant management API.
 * Forwards requests to FastPik's /api/admin/tenants with server-side API key,
 * so the admin doesn't need to input the key manually on each device.
 */

const FASTPIK_API = process.env.FASTPIK_API_URL || 'https://fastpik.id';
const FASTPIK_KEY = process.env.FASTPIK_ADMIN_API_KEY || '';

function parseUpstreamPayload(text: string, status: number, ok: boolean) {
    const trimmed = text.trim();
    if (!trimmed) {
        return ok
            ? { success: true }
            : { success: false, error: `FastPik API request failed with status ${status}` };
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return ok
            ? { success: true, data: trimmed }
            : { success: false, error: trimmed };
    }
}

async function proxyToFastpik(request: NextRequest, method: string) {
    if (!FASTPIK_KEY) {
        return NextResponse.json(
            { error: 'FASTPIK_ADMIN_API_KEY not configured on server' },
            { status: 500 }
        );
    }

    try {
        const headers: Record<string, string> = {
            'x-admin-api-key': FASTPIK_KEY,
        };

        const init: RequestInit = { method, headers };

        if (method !== 'GET') {
            const body = await request.text();
            if (body) {
                headers['Content-Type'] = 'application/json';
                init.body = body;
            }
        }

        if (method === 'GET') {
            const { requestedPage, pageSize, q } = parseListParams(request.nextUrl.searchParams);
            const sort = parseVendorSortMode(request.nextUrl.searchParams.get('sort'));
            const vendors = await fetchAllVendorPages<VendorListItem>(async (page, upstreamPageSize) => {
                const upstreamParams = new URLSearchParams({
                    page: String(page),
                    pageSize: String(upstreamPageSize),
                });
                const response = await fetch(`${FASTPIK_API}/api/admin/tenants?${upstreamParams}`, init);
                const text = await response.text();
                const data = parseUpstreamPayload(text, response.status, response.ok);
                if (!response.ok) {
                    const message = typeof data?.error === 'string' ? data.error : `FastPik API request failed with status ${response.status}`;
                    throw new Error(message);
                }
                return data;
            });

            return NextResponse.json(createVendorListResult(vendors, { requestedPage, pageSize, q, sort }));
        }

        const res = await fetch(`${FASTPIK_API}/api/admin/tenants`, init);
        const text = await res.text();
        const data = parseUpstreamPayload(text, res.status, res.ok);
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Vendor Fastpik proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to FastPik API' },
            { status: 502 }
        );
    }
}

// GET: List all tenants
export async function GET(request: NextRequest) {
    return proxyToFastpik(request, 'GET');
}

// POST: Create new tenant
export async function POST(request: NextRequest) {
    return proxyToFastpik(request, 'POST');
}

// PUT: Update existing tenant
export async function PUT(request: NextRequest) {
    return proxyToFastpik(request, 'PUT');
}

// DELETE: Delete existing tenant
export async function DELETE(request: NextRequest) {
    return proxyToFastpik(request, 'DELETE');
}
