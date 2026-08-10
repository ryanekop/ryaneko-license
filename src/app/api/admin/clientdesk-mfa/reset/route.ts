import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { recordAdminSecurityEvent } from '@/lib/admin-security-audit';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { sendEmail } from '@/lib/resend';
import { escapeTelegramHtml, notifyAlert } from '@/lib/telegram';

function requestIp(request: NextRequest) {
    return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}

function safeError(error: unknown) {
    const value = error as { message?: unknown; code?: unknown };
    return { code: typeof value?.code === 'string' ? value.code : undefined, message: typeof value?.message === 'string' ? value.message.slice(0, 200) : 'unknown_error' };
}

export async function POST(request: NextRequest) {
    const auth = await requireAdmin(request, { requireFreshTotp: true });
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as { userId?: string; email?: string; reason?: string } | null;
    const userId = body?.userId?.trim();
    const confirmationEmail = body?.email?.trim().toLowerCase();
    const reason = body?.reason?.trim();
    if (!userId || !confirmationEmail || !reason) return NextResponse.json({ outcome: 'invalid_request' }, { status: 400 });

    const auditBase = {
        actorUserId: auth.context.user.id, actorEmail: auth.context.user.email,
        action: 'clientdesk_mfa_admin_reset', targetUserId: userId, reason,
        ipAddress: requestIp(request), userAgent: request.headers.get('user-agent'),
    };
    const clientdesk = getClientDeskSupabase();
    const { data: userData, error: userError } = await clientdesk.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
        await recordAdminSecurityEvent({ ...auditBase, targetEmail: confirmationEmail, factorCount: 0, outcome: 'not_found', errorMetadata: safeError(userError) });
        return NextResponse.json({ outcome: 'not_found' }, { status: 404 });
    }
    const targetEmail = (userData.user.email || '').toLowerCase();
    if (targetEmail !== confirmationEmail) {
        await recordAdminSecurityEvent({ ...auditBase, targetEmail, factorCount: 0, outcome: 'email_mismatch' });
        return NextResponse.json({ outcome: 'email_mismatch' }, { status: 409 });
    }

    const { data: factorData, error: listError } = await clientdesk.auth.admin.mfa.listFactors({ userId });
    if (listError) {
        await recordAdminSecurityEvent({ ...auditBase, targetEmail, factorCount: 0, outcome: 'factor_lookup_failed', errorMetadata: safeError(listError) });
        return NextResponse.json({ outcome: 'factor_lookup_failed' }, { status: 502 });
    }
    const factors = factorData?.factors || [];
    if (factors.length === 0) {
        await recordAdminSecurityEvent({ ...auditBase, targetEmail, factorCount: 0, outcome: 'no_factors' });
        return NextResponse.json({ outcome: 'no_factors', deleted: 0, remaining: 0 });
    }

    const resetAt = new Date().toISOString();
    const { error: metadataError } = await clientdesk.auth.admin.updateUserById(userId, {
        app_metadata: {
            ...(userData.user.app_metadata || {}),
            clientdesk_mfa_recovery_required: true,
            clientdesk_mfa_recovery_reset_at: resetAt,
        },
    });
    if (metadataError) {
        await recordAdminSecurityEvent({ ...auditBase, targetEmail, factorCount: factors.length, outcome: 'metadata_failed', errorMetadata: safeError(metadataError) });
        return NextResponse.json({ outcome: 'metadata_failed' }, { status: 502 });
    }

    const failures: Array<{ factorId: string; error: Record<string, unknown> }> = [];
    let deleted = 0;
    for (const factor of factors) {
        const { error } = await clientdesk.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
        if (error) failures.push({ factorId: factor.id, error: safeError(error) }); else deleted += 1;
    }
    const outcome = failures.length ? 'partial_failure' : 'success';
    await recordAdminSecurityEvent({ ...auditBase, targetEmail, factorCount: factors.length, outcome, errorMetadata: failures.length ? { failures } : {} });

    if (deleted > 0) {
        await Promise.allSettled([
            sendEmail({
                to: targetEmail,
                subject: 'Two-factor authentication ClientDesk telah direset',
                html: '<p>Autentikasi dua faktor akun ClientDesk Anda telah direset oleh bantuan admin.</p><p>Semua sesi telah dicabut. Saat login berikutnya, Anda wajib menambahkan autentikator TOTP baru sebelum dapat membuka data bisnis.</p><p>Jika Anda tidak meminta bantuan ini, segera hubungi dukungan ClientDesk.</p>',
            }),
            notifyAlert(`<b>ClientDesk 2FA Reset</b>\n\nAdmin: ${escapeTelegramHtml(auth.context.user.email)}\nTarget: ${escapeTelegramHtml(targetEmail)}\nFaktor dihapus: ${deleted}/${factors.length}\nHasil: ${escapeTelegramHtml(outcome)}\nAlasan: ${escapeTelegramHtml(reason)}`),
        ]);
    }
    return NextResponse.json({ outcome, deleted, remaining: failures.length, resetAt }, { status: failures.length ? 207 : 200 });
}
