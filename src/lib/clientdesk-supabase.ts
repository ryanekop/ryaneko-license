import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Shared Client Desk Supabase Admin Client
// Uses CLIENTDESK_SUPABASE_URL + CLIENTDESK_SUPABASE_SERVICE_KEY env vars
let _clientdeskSupabase: SupabaseClient | null = null;

export function getClientDeskSupabase(): SupabaseClient {
    if (!_clientdeskSupabase) {
        const url = process.env.CLIENTDESK_SUPABASE_URL;
        const key = process.env.CLIENTDESK_SUPABASE_SERVICE_KEY;

        if (!url || !key) {
            throw new Error('CLIENTDESK_SUPABASE_URL and CLIENTDESK_SUPABASE_SERVICE_KEY must be set');
        }

        _clientdeskSupabase = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }

    return _clientdeskSupabase;
}
