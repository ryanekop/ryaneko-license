import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

function generateSerial(): string {
    const bytes = crypto.randomBytes(8);
    const hex = bytes.toString('hex').toUpperCase();
    return `${hex.slice(0, 8)}-${hex.slice(8, 16)}`;
}

function hashSerial(serial: string): string {
    return crypto.createHash('sha256').update(serial).digest('hex');
}

export async function POST(request: NextRequest) {
    try {
        const { productSlug, count } = await request.json();

        if (!productSlug || !count || count < 1 || count > 100) {
            return NextResponse.json(
                { error: 'Invalid parameters. Product required, count 1-100.' },
                { status: 400 }
            );
        }

        // Get product ID from slug
        const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, name')
            .eq('slug', productSlug)
            .single();

        if (productError || !product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        // Get all existing serial keys to avoid duplicates
        const { data: existing } = await supabaseAdmin
            .from('licenses')
            .select('serial_key');

        const existingKeys = new Set((existing || []).map(l => l.serial_key));

        // Generate unique serials
        const batchId = `BATCH-${Date.now()}`;
        const serials: { serial_key: string; serial_hash: string; product_id: string; status: string; batch_info: string }[] = [];

        for (let i = 0; i < count; i++) {
            let serial: string;
            let attempts = 0;

            // Ensure uniqueness
            do {
                serial = generateSerial();
                attempts++;
                if (attempts > 100) {
                    return NextResponse.json(
                        { error: 'Failed to generate unique serials after many attempts' },
                        { status: 500 }
                    );
                }
            } while (existingKeys.has(serial) || serials.some(s => s.serial_key === serial));

            serials.push({
                serial_key: serial,
                serial_hash: hashSerial(serial),
                product_id: product.id,
                status: 'available',
                batch_info: batchId,
            });
        }

        // Insert all serials
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('licenses')
            .insert(serials)
            .select('serial_key, serial_hash');

        if (insertError) {
            return NextResponse.json(
                { error: insertError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            product: product.name,
            batchId,
            count: inserted?.length || 0,
            serials: inserted || [],
        });
    } catch (error) {
        console.error('Generate error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
