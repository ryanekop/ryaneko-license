import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export const getSupabase = () => {
    if (!_supabase && supabaseUrl && supabaseAnonKey) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
};

export const getSupabaseAdmin = () => {
    if (!_supabaseAdmin && supabaseUrl && supabaseServiceKey) {
        _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _supabaseAdmin;
};

// For backwards compatibility - will throw if not configured
export const supabase = {
    get from() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');
        return client.from.bind(client);
    }
};

export const supabaseAdmin = {
    get from() {
        const client = getSupabaseAdmin();
        if (!client) throw new Error('Supabase Admin not configured');
        return client.from.bind(client);
    }
};

