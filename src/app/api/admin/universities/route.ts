import { NextRequest, NextResponse } from 'next/server';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { createPagination } from '@/lib/pagination';
import { canonicalizeUniversityName, universityNameKeys, universitySearchVariants } from '@/lib/university-names';

const TABLE_CANDIDATES = ['university_references', 'univeristy_references'] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
let cachedTableName: string | null = null;

function normalizeName(value: unknown): string {
    return canonicalizeUniversityName(value);
}

function normalizeNameKey(value: string): string {
    return value.toLowerCase();
}

function normalizeAbbreviation(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function getConflictType(error: unknown): 'name' | 'abbreviation' | null {
    if (!error || typeof error !== 'object') return null;
    const code = (error as { code?: string }).code;
    if (code !== '23505') return null;

    const message = String((error as { message?: string }).message || '').toLowerCase();
    if (message.includes('normalized_name') || message.includes('name')) return 'name';
    if (message.includes('normalized_abbreviation') || message.includes('abbreviation')) return 'abbreviation';
    return 'abbreviation';
}

function parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
}

function parsePageSize(value: string | null): number {
    const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
        ? parsed
        : DEFAULT_PAGE_SIZE;
}

function escapeIlikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function applySearchFilter<T extends { or: (filters: string) => T }>(query: T, keyword: string) {
    const q = keyword.trim();
    if (!q) return query;
    const nameFilters = universitySearchVariants(q).map((variant) => `name.ilike.${JSON.stringify(`%${escapeIlikePattern(variant)}%`)}`);
    return query.or([...nameFilters, `abbreviation.ilike.${JSON.stringify(`%${escapeIlikePattern(q)}%`)}`].join(','));
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

export async function GET(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const tableName = await resolveUniversityTableName();
        const q = request.nextUrl.searchParams.get('q') || '';
        const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
        const pageSize = parsePageSize(request.nextUrl.searchParams.get('pageSize'));

        let countQuery = supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true });
        countQuery = applySearchFilter(countQuery, q);
        const { count, error: countError } = await countQuery;

        if (countError) {
            return NextResponse.json({ error: countError.message }, { status: 500 });
        }

        const total = count || 0;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(requestedPage, totalPages);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let itemsQuery = supabase
            .from(tableName)
            .select('*')
            .order('name', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to);
        itemsQuery = applySearchFilter(itemsQuery, q);
        const { data, error } = await itemsQuery;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            items: data || [],
            total,
            page,
            pageSize,
            pagination: createPagination(total, page, pageSize as 10 | 25 | 50 | 100),
        });
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
        const normalizedName = normalizeNameKey(name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!name || !abbreviation) {
            return NextResponse.json({ error: 'name and abbreviation are required' }, { status: 400 });
        }

        const { data: existingNames, error: existingByNameError } = await supabase
            .from(tableName)
            .select('*')
            .in('normalized_name', universityNameKeys(typeof body?.name === 'string' ? body.name : name))
            .limit(2);

        if (existingByNameError) {
            return NextResponse.json({ error: existingByNameError.message }, { status: 500 });
        }

        if (existingNames && existingNames.length > 1) {
            return NextResponse.json({ error: 'multiple equivalent names already exist' }, { status: 409 });
        }
        const existingByName = existingNames?.[0];

        if (existingByName) {
            const existingAbbreviation = normalizeAbbreviation(existingByName.abbreviation);
            if (!existingAbbreviation) {
                const { data: upgraded, error: upgradeError } = await supabase
                    .from(tableName)
                    .update({
                        name,
                        abbreviation,
                        normalized_name: normalizedName,
                    })
                    .eq('id', existingByName.id)
                    .select()
                    .single();

                if (upgradeError) {
                    const conflictType = getConflictType(upgradeError);
                    if (conflictType === 'name') {
                        return NextResponse.json({ error: 'name already exists' }, { status: 409 });
                    }
                    if (conflictType === 'abbreviation') {
                        return NextResponse.json({ error: 'abbreviation already exists' }, { status: 409 });
                    }
                    return NextResponse.json({ error: upgradeError.message }, { status: 500 });
                }

                return NextResponse.json({ item: upgraded, action: 'upgraded' }, { status: 200 });
            }

            return NextResponse.json({ error: 'name already exists' }, { status: 409 });
        }

        const { data, error } = await supabase
            .from(tableName)
            .insert({
                name,
                abbreviation,
                normalized_name: normalizedName,
            })
            .select()
            .single();

        if (error) {
            const conflictType = getConflictType(error);
            if (conflictType === 'name') {
                return NextResponse.json({ error: 'name already exists' }, { status: 409 });
            }
            if (conflictType === 'abbreviation') {
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
        const normalizedName = normalizeNameKey(name);
        const abbreviation = normalizeAbbreviation(body?.abbreviation);

        if (!id || !name || !abbreviation) {
            return NextResponse.json({ error: 'id, name, and abbreviation are required' }, { status: 400 });
        }

        const { data: existingNames, error: existingNamesError } = await supabase
            .from(tableName)
            .select('id')
            .in('normalized_name', universityNameKeys(typeof body?.name === 'string' ? body.name : name))
            .neq('id', id)
            .limit(1);

        if (existingNamesError) {
            return NextResponse.json({ error: existingNamesError.message }, { status: 500 });
        }
        if (existingNames?.length) {
            return NextResponse.json({ error: 'name already exists' }, { status: 409 });
        }

        const { data, error } = await supabase
            .from(tableName)
            .update({
                name,
                abbreviation,
                normalized_name: normalizedName,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const conflictType = getConflictType(error);
            if (conflictType === 'name') {
                return NextResponse.json({ error: 'name already exists' }, { status: 409 });
            }
            if (conflictType === 'abbreviation') {
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
