/**
 * Fix script: normalize device_type values in Supabase
 * "macOS" → "Mac", "macOS-Monterey" → "Mac (Monterey)", etc.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oizyehujwjxdcgdwwaws.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(raw) {
    if (!raw) return raw;
    const lower = raw.toLowerCase().trim();
    if (lower.startsWith('macos') || lower.startsWith('mac os')) {
        const match = raw.match(/^mac\s*os[\s\-_]*(.+)$/i);
        if (match && match[1]) {
            const ver = match[1].trim();
            return `Mac (${ver.charAt(0).toUpperCase() + ver.slice(1)})`;
        }
        return 'Mac';
    }
    if (lower.startsWith('windows')) return 'Windows';
    return raw;
}

async function fix() {
    const { data, error } = await sb.from('licenses').select('id, device_type').not('device_type', 'is', null);
    if (error) { console.error(error); return; }

    const toFix = data.filter(r => {
        const n = normalize(r.device_type);
        return n !== r.device_type;
    });

    console.log('Records to fix:', toFix.length);
    const counts = {};
    toFix.forEach(r => { counts[r.device_type] = (counts[r.device_type] || 0) + 1; });
    console.log('Breakdown:', counts);

    let fixed = 0;
    for (const row of toFix) {
        const newType = normalize(row.device_type);
        const { error: upErr } = await sb.from('licenses').update({ device_type: newType }).eq('id', row.id);
        if (upErr) console.log('Error:', row.id, upErr.message);
        else fixed++;
    }

    console.log('Fixed:', fixed);
}

fix().catch(console.error);
