import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const productSlug = searchParams.get('product');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from('licenses')
        .select('*, product:products!inner(*)', { count: 'exact' });

    // Filter by product
    if (productSlug) {
        query = query.eq('product.slug', productSlug);
    }

    // Filter by status
    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    // Search by name, email, or serial
    if (search) {
        query = query.or(
            `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,serial_key.ilike.%${search}%`
        );
    }

    // Pagination
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        licenses: data,
        total: count,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
    });
}

// Update license
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('licenses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
