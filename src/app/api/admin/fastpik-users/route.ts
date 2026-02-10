import { NextRequest, NextResponse } from 'next/server';

const FASTPIK_API = 'https://fastpik.ryanekoapp.web.id';
const ADMIN_SECRET = process.env.FASTPIK_ADMIN_SECRET || 'fastpik-ryan-2024-secret';

// Proxy GET - list users
export async function GET() {
    try {
        const res = await fetch(`${FASTPIK_API}/api/admin/users`, {
            headers: { 'x-admin-secret': ADMIN_SECRET },
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy GET error:', error);
        return NextResponse.json({ success: false, message: 'Failed to reach Fastpik API' }, { status: 502 });
    }
}

// Proxy POST - create trial user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        body.secretKey = ADMIN_SECRET;

        const res = await fetch(`${FASTPIK_API}/api/admin/create-trial-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy POST error:', error);
        return NextResponse.json({ success: false, message: 'Failed to reach Fastpik API' }, { status: 502 });
    }
}

// Proxy DELETE - delete user
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();

        const res = await fetch(`${FASTPIK_API}/api/admin/users`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Failed to reach Fastpik API' }, { status: 502 });
    }
}

// Proxy PATCH - edit user (set_expiry, change_tier)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();

        const res = await fetch(`${FASTPIK_API}/api/admin/users`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy PATCH error:', error);
        return NextResponse.json({ success: false, message: 'Failed to reach Fastpik API' }, { status: 502 });
    }
}
