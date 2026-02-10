/**
 * Fix script: insert remaining raw-file-copy-tool licenses one-by-one
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fix() {
    // Get product ID
    const { data: prod } = await sb.from('products').select('id').eq('slug', 'raw-file-copy-tool').single();
    console.log('Product ID:', prod.id);

    // Get existing serial keys
    const { data: existing } = await sb.from('licenses').select('serial_key').eq('product_id', prod.id);
    const existingSet = new Set(existing.map(l => l.serial_key));
    console.log('Existing in DB:', existingSet.size);

    // Parse CSV
    const csv = readFileSync(__dirname + '/data/raw-file-copy-tool.csv', 'utf-8');
    const lines = csv.split('\n').filter(l => l.trim());
    console.log('CSV rows:', lines.length - 1);

    const seenKeys = new Set();
    let inserted = 0, skipped = 0, errors = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const serial = (cols[0] || '').trim();
        const hash = (cols[1] || '').trim();
        const status = (cols[2] || '').trim();
        const user = (cols[3] || '').trim() || null;
        const device = (cols[4] || '').trim() || null;

        if (!serial || existingSet.has(serial) || seenKeys.has(serial)) {
            skipped++;
            continue;
        }
        seenKeys.add(serial);

        const { error } = await sb.from('licenses').insert({
            serial_key: serial,
            serial_hash: hash || createHash('sha256').update(serial).digest('hex'),
            status: status === 'used' ? 'used' : 'available',
            customer_name: user,
            device_type: device,
            product_id: prod.id,
        });

        if (error) {
            errors++;
            console.log('  Error:', serial, error.message);
        } else {
            inserted++;
        }
    }

    console.log('\nResult: Inserted:', inserted, '| Skipped:', skipped, '| Errors:', errors);

    // Final counts
    const { count: total } = await sb.from('licenses').select('*', { count: 'exact', head: true }).eq('product_id', prod.id);
    const { count: used } = await sb.from('licenses').select('*', { count: 'exact', head: true }).eq('product_id', prod.id).eq('status', 'used');
    console.log('Total RAW File Copy Tool:', total, '(' + used + ' used)');
}

fix().catch(console.error);
