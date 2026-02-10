/**
 * Data Migration Script
 * Imports licenses from Google Sheets CSV exports to Supabase
 * 
 * Usage:
 *   1. Export each sheet from Google Sheets as CSV
 *   2. Place CSV files in the /migration/data/ folder:
 *      - raw-file-copy-tool.csv
 *      - realtime-upload-pro.csv
 *      - photo-split-express.csv
 *   3. Run: node migration/migrate.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- CONFIG ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oizyehujwjxdcgdwwaws.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required.');
    console.error('   Set it as environment variable or in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- CSV PARSER ---
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = parseLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j].trim().toLowerCase()] = (values[j] || '').trim();
        }
        rows.push(row);
    }

    return rows;
}

function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// --- PRODUCT MAPPING ---
const PRODUCT_FILES = [
    {
        slug: 'raw-file-copy-tool',
        filename: 'raw-file-copy-tool.csv',
        // Column mapping: CSV header → DB column
        //  RAW File Copy Tool uses: serial, hash, status, User, Device, Device ID, Timestamp, Email, Order ID, Batch
        mapRow: (row) => ({
            serial_key: row['serial'] || row['serial number'] || '',
            serial_hash: row['hash'] || '',
            status: mapStatus(row['status']),
            customer_name: row['user'] || row['user name'] || '',
            device_type: row['device'] || '',
            device_id: row['device id'] || '',
            activated_at: parseTimestamp(row['timestamp'] || row['timestam']),
            customer_email: row['email'] || '',
            order_id: row['order id'] || '',
            batch_info: row['batch'] || '',
        }),
    },
    {
        slug: 'realtime-upload-pro',
        filename: 'realtime-upload-pro.csv',
        // RU Pro uses: Serial Number, Hash, Status, User Name, Device Type, Device ID, Last Active, Email, Order ID, Notes
        mapRow: (row) => ({
            serial_key: row['serial number'] || row['serial'] || '',
            serial_hash: row['hash'] || '',
            status: mapStatus(row['status']),
            customer_name: row['user name'] || row['user'] || '',
            device_type: row['device type'] || row['device'] || '',
            device_id: row['device id'] || '',
            activated_at: parseTimestamp(row['last active'] || row['timestamp']),
            customer_email: row['email'] || '',
            order_id: row['order id'] || '',
            notes: row['notes'] || '',
        }),
    },
    {
        slug: 'photo-split-express',
        filename: 'photo-split-express.csv',
        // Same structure as RU Pro
        mapRow: (row) => ({
            serial_key: row['serial number'] || row['serial'] || '',
            serial_hash: row['hash'] || '',
            status: mapStatus(row['status']),
            customer_name: row['user name'] || row['user'] || '',
            device_type: row['device type'] || row['device'] || '',
            device_id: row['device id'] || '',
            activated_at: parseTimestamp(row['last active'] || row['timestamp']),
            customer_email: row['email'] || '',
            order_id: row['order id'] || '',
            notes: row['notes'] || '',
        }),
    },
];

function mapStatus(status) {
    if (!status) return 'available';
    const s = status.toLowerCase().trim();
    if (s === 'used' || s === 'active') return 'used';
    if (s === 'revoked' || s === 'disabled') return 'revoked';
    return 'available';
}

function parseTimestamp(value) {
    if (!value) return null;
    // Try parsing various date formats
    // Format from screenshot: 01/02/2026 (DD/MM/YYYY)
    const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
    }
    // Try standard date parse
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }
    return null;
}

function generateHashIfMissing(serialKey, existingHash) {
    if (existingHash) return existingHash;
    return createHash('sha256').update(serialKey).digest('hex');
}

// --- MAIN MIGRATION ---
async function migrate() {
    console.log('🚀 Starting Data Migration\n');

    // Step 1: Get product IDs from Supabase
    console.log('📋 Fetching products from Supabase...');
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, slug, name');

    if (prodError) {
        console.error('❌ Failed to fetch products:', prodError.message);
        console.error('   Have you run supabase_schema.sql yet?');
        process.exit(1);
    }

    if (!products || products.length === 0) {
        console.error('❌ No products found. Run supabase_schema.sql first.');
        process.exit(1);
    }

    console.log(`   Found ${products.length} products:`);
    products.forEach(p => console.log(`   - ${p.name} (${p.slug})`));
    console.log('');

    const productMap = {};
    products.forEach(p => { productMap[p.slug] = p.id; });

    // Step 2: Process each CSV file
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const config of PRODUCT_FILES) {
        const filepath = resolve(__dirname, 'data', config.filename);

        if (!existsSync(filepath)) {
            console.log(`⏭️  Skipping ${config.slug} (file not found: ${config.filename})`);
            continue;
        }

        const productId = productMap[config.slug];
        if (!productId) {
            console.error(`❌ Product not found in DB: ${config.slug}`);
            continue;
        }

        console.log(`📦 Importing ${config.slug}...`);
        const csvText = readFileSync(filepath, 'utf-8');
        const rows = parseCSV(csvText);
        console.log(`   Found ${rows.length} rows in CSV`);

        // Check existing licenses for this product (avoid duplicates)
        const { data: existing } = await supabase
            .from('licenses')
            .select('serial_key')
            .eq('product_id', productId);

        const existingKeys = new Set((existing || []).map(l => l.serial_key));

        // Prepare batch insert
        const toInsert = [];
        let skipped = 0;

        for (const row of rows) {
            const mapped = config.mapRow(row);

            // Skip if no serial key
            if (!mapped.serial_key) {
                skipped++;
                continue;
            }

            // Skip duplicates
            if (existingKeys.has(mapped.serial_key)) {
                skipped++;
                continue;
            }

            // Ensure hash exists
            mapped.serial_hash = generateHashIfMissing(mapped.serial_key, mapped.serial_hash);
            mapped.product_id = productId;

            // Set last_active_at = activated_at for used licenses
            if (mapped.status === 'used' && mapped.activated_at) {
                mapped.last_active_at = mapped.activated_at;
            }

            // Clean empty strings
            Object.keys(mapped).forEach(key => {
                if (mapped[key] === '') mapped[key] = null;
            });

            toInsert.push(mapped);
        }

        console.log(`   To insert: ${toInsert.length} | Skipped: ${skipped}`);

        // Batch insert (50 at a time)
        if (toInsert.length > 0) {
            const batchSize = 50;
            let inserted = 0;
            let errors = 0;

            for (let i = 0; i < toInsert.length; i += batchSize) {
                const batch = toInsert.slice(i, i + batchSize);
                const { error: insertError } = await supabase
                    .from('licenses')
                    .insert(batch);

                if (insertError) {
                    console.error(`   ❌ Batch error (rows ${i}-${i + batch.length}):`, insertError.message);
                    errors += batch.length;
                } else {
                    inserted += batch.length;
                }
            }

            console.log(`   ✅ Inserted: ${inserted} | ❌ Errors: ${errors}`);
            totalImported += inserted;
            totalErrors += errors;
        }

        totalSkipped += skipped;
        console.log('');
    }

    // Step 3: Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary');
    console.log(`   ✅ Imported: ${totalImported}`);
    console.log(`   ⏭️  Skipped:  ${totalSkipped}`);
    console.log(`   ❌ Errors:   ${totalErrors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Step 4: Verify counts
    console.log('\n🔍 Verification...');
    for (const config of PRODUCT_FILES) {
        const productId = productMap[config.slug];
        if (!productId) continue;

        const { count } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', productId);

        const { count: usedCount } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', productId)
            .eq('status', 'used');

        console.log(`   ${config.slug}: ${count} total (${usedCount} used)`);
    }

    console.log('\n✨ Migration complete!');
}

migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
