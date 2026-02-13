/**
 * One-time sync script: CSV serial data → Supabase
 * 
 * Usage:
 *   npx tsx scripts/sync-csv-to-supabase.ts [--dry-run]
 * 
 * - Reads CSV from the RAW File Copy Tool database
 * - Compares with existing serials in Supabase
 * - Inserts new serials & updates existing ones with missing customer info
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CSV_PATH = resolve('/Volumes/Data Ryan/Software Mac/Develop Software/RAW File Copy Tool/Database/Serial Number RAW File Copy Tool - Sheet1.csv');
const PRODUCT_SLUG = 'raw-file-copy-tool';
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ─────────────────────────────────────────────────────
function parseCSV(content: string) {
    const lines = content.split('\n').map(l => l.replace(/\r$/, ''));
    const header = lines[0].split(',');

    return lines.slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
            const parts = line.split(',');
            return {
                serial_key: parts[0]?.trim() || '',
                serial_hash: parts[1]?.trim() || '',
                status: parts[2]?.trim() || '',
                user: parts[3]?.trim() || '',
                device: parts[4]?.trim() || '',
            };
        })
        .filter(row => row.serial_key !== '');
}

function mapDeviceType(device: string): string | null {
    if (!device) return null;
    const d = device.toLowerCase();
    if (d.includes('monterey')) return 'macOS-Monterey';
    if (d.includes('mac')) return 'macOS';
    if (d.includes('windows')) return 'Windows';
    return device;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
    console.log('🔄 CSV → Supabase Sync for RAW File Copy Tool');
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE'}`);
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing SUPABASE env vars. Make sure .env.local is loaded.');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Read CSV
    console.log('📖 Reading CSV...');
    const csvContent = readFileSync(CSV_PATH, 'utf-8');
    const csvRows = parseCSV(csvContent);
    console.log(`   Found ${csvRows.length} rows in CSV`);

    // 2. Get product ID
    const { data: product, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .eq('slug', PRODUCT_SLUG)
        .single();

    if (prodError || !product) {
        console.error('❌ Product not found:', prodError?.message);
        process.exit(1);
    }
    console.log(`   Product: ${product.name} (${product.id})`);

    // 3. Get existing serials from Supabase
    console.log('📥 Fetching existing serials from Supabase...');
    const { data: existingLicenses, error: fetchError } = await supabase
        .from('licenses')
        .select('id, serial_key, serial_hash, status, customer_name, device_type')
        .eq('product_id', product.id);

    if (fetchError) {
        console.error('❌ Error fetching licenses:', fetchError.message);
        process.exit(1);
    }

    const existingMap = new Map<string, typeof existingLicenses[0]>();
    for (const lic of existingLicenses || []) {
        existingMap.set(lic.serial_key, lic);
    }
    console.log(`   Found ${existingMap.size} existing serials in Supabase`);

    // 4. Categorize changes
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];
    let skipped = 0;

    for (const row of csvRows) {
        const existing = existingMap.get(row.serial_key);

        if (!existing) {
            // New serial - needs to be inserted
            const record: Record<string, unknown> = {
                serial_key: row.serial_key,
                serial_hash: row.serial_hash || null,
                product_id: product.id,
                status: row.status === 'used' ? 'used' : 'available',
            };

            if (row.user) {
                record.customer_name = row.user;
            }
            if (row.device) {
                record.device_type = mapDeviceType(row.device);
            }

            toInsert.push(record);
        } else {
            // Existing serial - check if customer info needs updating
            const needsUpdate = (
                // CSV has customer name but Supabase doesn't
                (row.user && !existing.customer_name) ||
                // CSV has device type but Supabase doesn't  
                (row.device && !existing.device_type) ||
                // Status mismatch (CSV says used but Supabase says available)
                (row.status === 'used' && existing.status === 'available')
            );

            if (needsUpdate) {
                const updateData: Record<string, unknown> = {};

                if (row.user && !existing.customer_name) {
                    updateData.customer_name = row.user;
                }
                if (row.device && !existing.device_type) {
                    updateData.device_type = mapDeviceType(row.device);
                }
                if (row.status === 'used' && existing.status === 'available') {
                    updateData.status = 'used';
                }

                if (Object.keys(updateData).length > 0) {
                    toUpdate.push({ id: existing.id, data: updateData });
                } else {
                    skipped++;
                }
            } else {
                skipped++;
            }
        }
    }

    // 5. Summary
    console.log('');
    console.log('📊 Sync Summary:');
    console.log(`   🆕 New serials to insert: ${toInsert.length}`);
    console.log(`   ✏️  Existing to update:    ${toUpdate.length}`);
    console.log(`   ⏭️  Already synced (skip): ${skipped}`);
    console.log('');

    if (toInsert.length === 0 && toUpdate.length === 0) {
        console.log('✅ Everything is already synced! Nothing to do.');
        return;
    }

    // Show some examples
    if (toInsert.length > 0) {
        console.log('   📝 Sample inserts:');
        for (const row of toInsert.slice(0, 5)) {
            console.log(`      ${row.serial_key} | ${row.customer_name || '(available)'} | ${row.device_type || '-'}`);
        }
        if (toInsert.length > 5) console.log(`      ... and ${toInsert.length - 5} more`);
        console.log('');
    }

    if (toUpdate.length > 0) {
        console.log('   📝 Sample updates:');
        for (const upd of toUpdate.slice(0, 5)) {
            console.log(`      ${upd.id} → ${JSON.stringify(upd.data)}`);
        }
        if (toUpdate.length > 5) console.log(`      ... and ${toUpdate.length - 5} more`);
        console.log('');
    }

    if (DRY_RUN) {
        console.log('🔍 DRY RUN complete. No changes made.');
        console.log('   Run without --dry-run to apply changes.');
        return;
    }

    // 6. Apply changes
    console.log('⚡ Applying changes...');

    // Insert new serials in batches of 50
    if (toInsert.length > 0) {
        const BATCH_SIZE = 50;
        let inserted = 0;

        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const batch = toInsert.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabase
                .from('licenses')
                .insert(batch);

            if (insertError) {
                console.error(`   ❌ Insert error at batch ${i / BATCH_SIZE + 1}:`, insertError.message);
                // Continue with next batch
            } else {
                inserted += batch.length;
                console.log(`   ✅ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} serials`);
            }
        }
        console.log(`   📦 Total inserted: ${inserted}`);
    }

    // Update existing serials
    if (toUpdate.length > 0) {
        let updated = 0;
        for (const upd of toUpdate) {
            const { error: updateError } = await supabase
                .from('licenses')
                .update(upd.data)
                .eq('id', upd.id);

            if (updateError) {
                console.error(`   ❌ Update error for ${upd.id}:`, updateError.message);
            } else {
                updated++;
            }
        }
        console.log(`   📦 Total updated: ${updated}`);
    }

    console.log('');
    console.log('🎉 Sync complete!');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
