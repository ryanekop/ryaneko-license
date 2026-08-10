#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const [userId, confirmation] = process.argv.slice(2);
if (!userId || confirmation !== `RESET-${userId}`) {
    console.error('Usage: npm run admin:break-glass-mfa -- <admin-user-uuid> RESET-<admin-user-uuid>');
    process.exit(1);
}

const allowed = new Set((process.env.RYANEKO_ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
if (!allowed.has(userId)) {
    console.error('Refusing: target is not present in RYANEKO_ADMIN_USER_IDS.');
    process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
if (error) throw error;
let deleted = 0;
for (const factor of data?.factors || []) {
    const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
    if (deleteError) throw deleteError;
    deleted += 1;
}
console.log(`Deleted ${deleted} MFA factor(s) for allowlisted Ryaneko admin ${userId}.`);
