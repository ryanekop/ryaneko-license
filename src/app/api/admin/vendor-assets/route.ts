import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import {
    buildVendorAssetPath,
    extractManagedVendorAssetPath,
    parseVendorAssetSlug,
    parseVendorAssetType,
    parseVendorProduct,
    VENDOR_ASSET_BUCKET,
    VENDOR_ASSET_CONFIG,
    VENDOR_ASSET_RAW_MAX_BYTES,
    type VendorProduct,
} from '@/lib/vendor-assets';
import { normalizeVendorImage } from '@/lib/vendor-image';

export const runtime = 'nodejs';

function getProductStorage(product: VendorProduct): { client: SupabaseClient; origin: string } {
    const origin = product === 'fastpik'
        ? process.env.FASTPIK_SUPABASE_URL
        : process.env.CLIENTDESK_SUPABASE_URL;

    if (!origin) throw new Error(`Supabase URL for ${product} is not configured`);

    return {
        client: product === 'fastpik' ? getFastpikSupabase() : getClientDeskSupabase(),
        origin,
    };
}

async function ensureVendorAssetBucket(client: SupabaseClient) {
    const { data: existing, error: existingError } = await client.storage.getBucket(VENDOR_ASSET_BUCKET);
    if (existing) return;

    if (existingError && !/not\s*found/i.test(existingError.message || '')) {
        throw existingError;
    }

    const { error: createError } = await client.storage.createBucket(VENDOR_ASSET_BUCKET, {
        public: true,
        fileSizeLimit: VENDOR_ASSET_CONFIG.logo.maxBytes,
        allowedMimeTypes: ['image/png'],
    });

    if (createError && !/already\s+exists|duplicate/i.test(createError.message || '')) {
        throw createError;
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const product = parseVendorProduct(formData.get('product'));
        const assetType = parseVendorAssetType(formData.get('assetType'));
        const tenantSlug = parseVendorAssetSlug(formData.get('tenantSlug'));
        const file = formData.get('file');

        if (!product || !assetType || !tenantSlug) {
            return NextResponse.json({ error: 'Invalid product, asset type, or tenant slug' }, { status: 400 });
        }
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
        }
        if (file.size <= 0 || file.size > VENDOR_ASSET_RAW_MAX_BYTES) {
            return NextResponse.json({ error: 'Image must not exceed 10 MB' }, { status: 413 });
        }

        const input = Buffer.from(await file.arrayBuffer());
        const output = await normalizeVendorImage(input, assetType);
        const { client } = getProductStorage(product);
        await ensureVendorAssetBucket(client);

        const objectPath = buildVendorAssetPath(tenantSlug, assetType);
        const { error: uploadError } = await client.storage
            .from(VENDOR_ASSET_BUCKET)
            .upload(objectPath, output, {
                contentType: 'image/png',
                cacheControl: '31536000',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data } = client.storage.from(VENDOR_ASSET_BUCKET).getPublicUrl(objectPath);
        return NextResponse.json({ url: data.publicUrl, objectPath });
    } catch (error) {
        console.error('Vendor asset upload failed:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload vendor asset';
        const status = /allowed|image|input|reduce/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const product = parseVendorProduct(body?.product);
        const tenantSlug = parseVendorAssetSlug(body?.tenantSlug);
        const urls = Array.isArray(body?.urls) ? body.urls.slice(0, 4) : [];

        if (!product || !tenantSlug || urls.length === 0) {
            return NextResponse.json({ error: 'Invalid cleanup request' }, { status: 400 });
        }

        const { client, origin } = getProductStorage(product);
        const paths: string[] = [];
        for (const url of urls) {
            const path = extractManagedVendorAssetPath(url, tenantSlug, origin);
            if (path) paths.push(path);
        }

        if (paths.length === 0) {
            return NextResponse.json({ removed: 0 });
        }

        const { error } = await client.storage.from(VENDOR_ASSET_BUCKET).remove([...new Set(paths)]);
        if (error) throw error;

        return NextResponse.json({ removed: new Set(paths).size });
    } catch (error) {
        console.error('Vendor asset cleanup failed:', error);
        const message = error instanceof Error ? error.message : 'Failed to clean up vendor assets';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
