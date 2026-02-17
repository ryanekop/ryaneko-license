/**
 * Migration Script: RAW File Copy Tool Serial Numbers
 * Source: "Serial Number RAW File Copy Tool - Sheet1.csv"
 * 
 * This script reads the CSV export and upserts data into the Supabase `licenses` table.
 * - New serials are inserted
 * - Existing serials are updated if they have new customer/device info or status changes
 * - Duplicate serials in CSV are skipped
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node migration/migrate-raw-file-copy-tool.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oizyehujwjxdcgdwwaws.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_FILE = 'Serial Number RAW File Copy Tool - Sheet1.csv';

async function migrate() {
    console.log('🚀 RAW File Copy Tool - Data Migration\n');

    // Step 1: Get product ID
    const { data: prod, error: prodErr } = await sb
        .from('products')
        .select('id')
        .eq('slug', 'raw-file-copy-tool')
        .single();

    if (prodErr || !prod) {
        console.error('❌ Product not found:', prodErr?.message);
        process.exit(1);
    }
    console.log('✅ Product ID:', prod.id);

    // Step 2: Get existing serial keys from DB
    const { data: existing } = await sb
        .from('licenses')
        .select('serial_key, customer_name, device_type, status')
        .eq('product_id', prod.id);

    const existingMap = new Map();
    (existing || []).forEach(l => existingMap.set(l.serial_key, l));
    console.log('📋 Existing in DB:', existingMap.size);

    // Step 3: Parse CSV
    const csv = readFileSync(__dirname + '/data/' + CSV_FILE, 'utf-8');
    const lines = csv.split('\n').filter(l => l.trim());
    const totalRows = lines.length - 1;
    console.log('📄 CSV rows:', totalRows);
    console.log('');

    const seenKeys = new Set();
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    for (let i = 1; i < lines.length; i++) {
        // Handle potential carriage returns
        const line = lines[i].replace(/\r$/, '');
        const cols = line.split(',');

        const serial = (cols[0] || '').trim();
        const hash = (cols[1] || '').trim();
        const status = (cols[2] || '').trim();
        const user = (cols[3] || '').trim() || null;
        const device = (cols[4] || '').trim() || null;

        // Skip empty serial keys
        if (!serial) {
            skipped++;
            continue;
        }

        // Skip duplicate serials within the CSV
        if (seenKeys.has(serial)) {
            skipped++;
            continue;
        }
        seenKeys.add(serial);

        const mappedStatus = status === 'used' ? 'used' : 'available';
        const serialHash = hash || createHash('sha256').update(serial).digest('hex');

        // Check if this serial already exists in DB
        const existingRecord = existingMap.get(serial);

        if (existingRecord) {
            // Check if we need to update (if DB record is missing info that CSV has)
            const needsUpdate =
                (!existingRecord.customer_name && user) ||
                (!existingRecord.device_type && device) ||
                (existingRecord.status === 'available' && mappedStatus === 'used');

            if (needsUpdate) {
                const updateData = {};
                if (!existingRecord.customer_name && user) updateData.customer_name = user;
                if (!existingRecord.device_type && device) updateData.device_type = device;
                if (existingRecord.status === 'available' && mappedStatus === 'used') updateData.status = 'used';

                const { error } = await sb
                    .from('licenses')
                    .update(updateData)
                    .eq('serial_key', serial)
                    .eq('product_id', prod.id);

                if (error) {
                    errors++;
                    console.log(`  ❌ Update error: ${serial} - ${error.message}`);
                } else {
                    updated++;
                }
            } else {
                skipped++;
            }
            continue;
        }

        // Insert new serial
        const { error } = await sb.from('licenses').insert({
            serial_key: serial,
            serial_hash: serialHash,
            status: mappedStatus,
            customer_name: user,
            device_type: device,
            product_id: prod.id,
        });

        if (error) {
            errors++;
            console.log(`  ❌ Insert error: ${serial} - ${error.message}`);
        } else {
            inserted++;
        }

        // Progress indicator every 50 rows
        if ((inserted + updated + errors) % 50 === 0 && (inserted + updated + errors) > 0) {
            console.log(`  ⏳ Progress: ${inserted} inserted, ${updated} updated, ${skipped} skipped...`);
        }
    }

    // Step 4: Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary');
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   🔄 Updated:  ${updated}`);
    console.log(`   ⏭️  Skipped:  ${skipped}`);
    console.log(`   ❌ Errors:   ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Step 5: Verify final counts
    const { count: total } = await sb
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', prod.id);

    const { count: usedCount } = await sb
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', prod.id)
        .eq('status', 'used');

    const { count: availableCount } = await sb
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', prod.id)
        .eq('status', 'available');

    console.log(`\n🔍 RAW File Copy Tool in DB:`);
    console.log(`   Total: ${total}`);
    console.log(`   Used: ${usedCount}`);
    console.log(`   Available: ${availableCount}`);
    console.log('\n✨ Migration complete!');
}

migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
