import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route for FastPik tenant management API.
 * Forwards requests to FastPik's /api/admin/tenants with server-side API key,
 * so the admin doesn't need to input the key manually on each device.
 */

const FASTPIK_API = process.env.FASTPIK_API_URL || 'https://fastpik.ryanekoapp.web.id';
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
