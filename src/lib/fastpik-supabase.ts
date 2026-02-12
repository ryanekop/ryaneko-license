import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Shared Fastpik Supabase Admin Client
// Uses FASTPIK_SUPABASE_URL + FASTPIK_SUPABASE_SERVICE_KEY env vars
let _fastpikSupabase: SupabaseClient | null = null;

export function getFastpikSupabase(): SupabaseClient {
    if (!_fastpikSupabase) {
        const url = process.env.FASTPIK_SUPABASE_URL;
        const key = process.env.FASTPIK_SUPABASE_SERVICE_KEY;

        if (!url || !key) {
            throw new Error('FASTPIK_SUPABASE_URL and FASTPIK_SUPABASE_SERVICE_KEY must be set');
        }

        _fastpikSupabase = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }

    return _fastpikSupabase;
}
