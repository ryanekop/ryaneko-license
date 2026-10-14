import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase.ts';
import { notifyAlert } from './telegram.ts';

interface AlertDependencies {
    db: Pick<SupabaseClient, 'from'>;
    send: (message: string) => Promise<boolean>;
    logError: (message: string) => void;
}

/** Claim before sending: one attempt per license, even across restarts and resets. */
export async function notifyGenericFallbackOnce(
    licenseId: string,
    message: string,
    { db = supabaseAdmin, send = notifyAlert, logError = console.error }: Partial<AlertDependencies> = {}
): Promise<void> {
    try {
        const { data, error } = await db
            .from('licenses')
            .update({ generic_fallback_alert_claimed_at: new Date().toISOString() })
            .eq('id', licenseId)
            .is('generic_fallback_alert_claimed_at', null)
            .select('id')
            .maybeSingle();

        if (error) {
            logError('Generic Windows fallback alert claim failed');
            return;
        }
        if (!data) return;

        // Keep the claim on failure: retrying could duplicate a delivered message.
        if (!await send(message)) {
            logError('Generic Windows fallback Telegram alert failed; claim retained');
        }
    } catch {
        // Notification failures must never reject a valid license request.
        logError('Generic Windows fallback notification failed');
    }
}
