import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function normalizeName(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function normalizeAbbreviation(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase();
}

function isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: string }).code;
    return code === '23505';
}

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('universities')
            .select('*')
            .order('abbreviation', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const name = normalizeName(body?.name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!name || !abbreviation) {
            return NextResponse.json({ error: 'name and abbreviation are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('universities')
            .insert({
                name,
                abbreviation,
            })
            .select()
            .single();

        if (error) {
            if (isUniqueViolation(error)) {
                return NextResponse.json({ error: 'abbreviation already exists' }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const id = typeof body?.id === 'string' ? body.id.trim() : '';
        const name = normalizeName(body?.name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!id || !name || !abbreviation) {
            return NextResponse.json({ error: 'id, name, and abbreviation are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('universities')
            .update({
                name,
                abbreviation,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (isUniqueViolation(error)) {
                return NextResponse.json({ error: 'abbreviation already exists' }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')?.trim() || '';

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('universities')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
