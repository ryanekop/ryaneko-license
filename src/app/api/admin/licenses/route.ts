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

    if (productSlug) {
        query = query.eq('product.slug', productSlug);
    }

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    if (search) {
        query = query.or(
            `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,serial_key.ilike.%${search}%`
        );
    }

    const hideEmpty = searchParams.get('hideEmpty');
    if (hideEmpty === 'true') {
        query = query.neq('status', 'available');
    }

    const sort = searchParams.get('sort');
    const ascending = sort === 'asc';

    query = query
        .order('created_at', { ascending })
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

// Update license (change device, reset status)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        let finalUpdate = updateData;

        // Reset action: clear device data and set to available, keep owner info
        if (action === 'reset') {
            finalUpdate = {
                status: 'available',
                device_type: null,
                device_id: null,
                activated_at: null,
                last_active_at: null,
            };
        }

        const { data, error } = await supabaseAdmin
            .from('licenses')
            .update(finalUpdate)
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

// Delete license
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        // Delete related activations first
        await supabaseAdmin
            .from('activations')
            .delete()
            .eq('license_id', id);

        const { error } = await supabaseAdmin
            .from('licenses')
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
