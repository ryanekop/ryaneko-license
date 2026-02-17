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

    // First, get the product ID for counting
    let productId: string | null = null;
    if (productSlug) {
        const { data: product } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('slug', productSlug)
            .single();
        productId = product?.id || null;
    }

    // Get total counts for all statuses (independent of filters/pagination)
    let totalAll = 0;
    let availableCount = 0;
    let usedCount = 0;

    if (productId) {
        const [totalRes, availableRes, usedRes] = await Promise.all([
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId),
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'available'),
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'used'),
        ]);
        totalAll = totalRes.count || 0;
        availableCount = availableRes.count || 0;
        usedCount = usedRes.count || 0;
    }

    // Build filtered query for the current page
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
            `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,serial_key.ilike.%${search}%,customer_instagram.ilike.%${search}%`
        );
    }

    const dataFilter = searchParams.get('dataFilter');
    if (dataFilter === 'with-data') {
        // Show only licenses that have customer data (used + available with names)
        query = query.or('status.neq.available,customer_name.not.is.null,customer_email.not.is.null,device_type.not.is.null');
    } else if (dataFilter === 'empty') {
        // Show only truly empty serials: available AND no customer data
        query = query.eq('status', 'available').is('customer_name', null).is('customer_email', null).is('device_type', null);
    }
    // 'all' or not provided = no filter

    const deviceFilter = searchParams.get('device');
    if (deviceFilter && deviceFilter !== 'all') {
        // Use ilike to match variants like "Mac (Monterey)" when filtering by "Mac"
        query = query.ilike('device_type', `${deviceFilter}%`);
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
        totalAll,
        availableCount,
        usedCount,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
    });
}

// Update license (change device, reset status, edit table)
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

        // Clear all action: clear everything including customer info
        if (action === 'clear') {
            finalUpdate = {
                status: 'available',
                customer_name: null,
                customer_email: null,
                customer_instagram: null,
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

// Delete = Clear info (name, email, device, etc.) but keep the serial
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        // Delete related activations
        await supabaseAdmin
            .from('activations')
            .delete()
            .eq('license_id', id);

        // Clear info instead of deleting the serial
        const { data, error } = await supabaseAdmin
            .from('licenses')
            .update({
                customer_name: null,
                customer_email: null,
                customer_instagram: null,
                device_type: null,
                device_id: null,
                status: 'available',
                activated_at: null,
                last_active_at: null,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
