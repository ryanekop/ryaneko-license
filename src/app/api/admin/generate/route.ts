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
        const { productSlug, count, action, serials: serialsToSave } = await request.json();

        // === STEP 2: SAVE to database ===
        if (action === 'save' && serialsToSave) {
            const { data: product } = await supabaseAdmin
                .from('products')
                .select('id, name')
                .eq('slug', productSlug)
                .single();

            if (!product) {
                return NextResponse.json({ error: 'Product not found' }, { status: 404 });
            }

            const batchId = `BATCH-${Date.now()}`;
            const rows = serialsToSave.map((s: { serial_key: string; serial_hash: string }) => ({
                serial_key: s.serial_key,
                serial_hash: s.serial_hash,
                product_id: product.id,
                status: 'available',
                batch_info: batchId,
            }));

            const { data: inserted, error: insertError } = await supabaseAdmin
                .from('licenses')
                .insert(rows)
                .select('serial_key, serial_hash');

            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                saved: true,
                product: product.name,
                batchId,
                count: inserted?.length || 0,
            });
        }

        // === STEP 1: GENERATE preview (no DB insert) ===
        if (!productSlug || !count || count < 1 || count > 100) {
            return NextResponse.json(
                { error: 'Invalid parameters. Product required, count 1-100.' },
                { status: 400 }
            );
        }

        const { data: product } = await supabaseAdmin
            .from('products')
            .select('id, name')
            .eq('slug', productSlug)
            .single();

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Get existing keys for uniqueness check
        const { data: existing } = await supabaseAdmin
            .from('licenses')
            .select('serial_key');

        const existingKeys = new Set((existing || []).map(l => l.serial_key));

        // Generate unique serials (preview only)
        const serials: { serial_key: string; serial_hash: string }[] = [];

        for (let i = 0; i < count; i++) {
            let serial: string;
            let attempts = 0;

            do {
                serial = generateSerial();
                attempts++;
                if (attempts > 100) {
                    return NextResponse.json(
                        { error: 'Failed to generate unique serials' },
                        { status: 500 }
                    );
                }
            } while (existingKeys.has(serial) || serials.some(s => s.serial_key === serial));

            serials.push({
                serial_key: serial,
                serial_hash: hashSerial(serial),
            });
        }

        return NextResponse.json({
            success: true,
            saved: false,
            product: product.name,
            count: serials.length,
            serials,
        });
    } catch (error) {
        console.error('Generate error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
