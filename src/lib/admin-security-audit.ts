import { getSupabaseAdmin } from '@/lib/supabase';

export async function recordAdminSecurityEvent(event: {
    actorUserId: string; actorEmail?: string | null; action: string;
    targetUserId?: string | null; targetEmail?: string | null; reason?: string | null;
    factorCount: number; outcome: string; ipAddress?: string | null; userAgent?: string | null;
    errorMetadata?: Record<string, unknown>;
}) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Ryaneko Supabase admin is not configured');
    const { error } = await admin.from('admin_security_events').insert({
        actor_user_id: event.actorUserId,
        actor_email: event.actorEmail || null,
        action: event.action,
        target_user_id: event.targetUserId || null,
        target_email: event.targetEmail || null,
        reason: event.reason || null,
        factor_count: event.factorCount,
        outcome: event.outcome,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        error_metadata: event.errorMetadata || {},
    });
    if (error) throw error;
}
