import { NextRequest, NextResponse } from 'next/server';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';

const TABLE_CANDIDATES = ['university_references', 'univeristy_references'] as const;
let cachedTableName: string | null = null;

function normalizeName(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function normalizeAbbreviation(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: string }).code;
    return code === '23505';
}

async function resolveUniversityTableName() {
    if (cachedTableName) return cachedTableName;

    const supabase = getClientDeskSupabase();
    for (const table of TABLE_CANDIDATES) {
        const { error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true });

        if (!error) {
            cachedTableName = table;
            return table;
        }
    }

    throw new Error(`University table not found. Checked: ${TABLE_CANDIDATES.join(', ')}`);
}

export async function GET() {
    try {
        const supabase = getClientDeskSupabase();
        const tableName = await resolveUniversityTableName();
        const { data, error } = await supabase
            .from(tableName)
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
        const supabase = getClientDeskSupabase();
        const tableName = await resolveUniversityTableName();
        const body = await request.json();
        const name = normalizeName(body?.name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!name || !abbreviation) {
            return NextResponse.json({ error: 'name and abbreviation are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from(tableName)
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
        const supabase = getClientDeskSupabase();
        const tableName = await resolveUniversityTableName();
        const body = await request.json();
        const id = typeof body?.id === 'string' ? body.id.trim() : '';
        const name = normalizeName(body?.name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!id || !name || !abbreviation) {
            return NextResponse.json({ error: 'id, name, and abbreviation are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from(tableName)
            .update({
                name,
                abbreviation,
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
        const supabase = getClientDeskSupabase();
        const tableName = await resolveUniversityTableName();
        const id = request.nextUrl.searchParams.get('id')?.trim() || '';

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from(tableName)
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
