import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { escapeTelegramHtml, notifyAlert } from '@/lib/telegram';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import type { VerifyRequest, VerifyResponse, License } from '@/lib/types';

// 30 requests per minute per IP
const verifyLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const tg = (value: unknown) => escapeTelegramHtml(value);

export async function POST(request: NextRequest) {
    try {
        // Rate limit check
        const ip = getClientIp(request);
        const { allowed, retryAfterMs } = verifyLimiter.check(ip);
        if (!allowed) {
            return rateLimitResponse(retryAfterMs);
        }

        const body: VerifyRequest = await request.json();
        const { serial_key, device_id } = body;

        // Validate required fields
        if (!serial_key || !device_id) {
            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // ip already extracted via getClientIp() above

        // Find license by serial key
        const { data: license, error: findError } = await supabaseAdmin
            .from('licenses')
            .select('*, product:products(*)')
            .eq('serial_key', serial_key)
            .single();

        if (findError || !license) {
            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'Invalid serial key' },
                { status: 404 }
            );
        }

        const licenseData = license as License & { product: { name: string } };

        // Check if revoked
        if (licenseData.status === 'revoked') {
            await logVerification(licenseData.id, device_id, ip, false, 'License revoked');

            await notifyAlert(
                `<b>🚫 REVOKED LICENSE BLOCKED</b>\n\n` +
                `⚙️ Action: verify\n` +
                `🔑 Serial: <code>${tg(serial_key)}</code>\n` +
                `📦 Product: ${tg(licenseData.product?.name || 'Unknown')}\n` +
                `👤 Name: ${tg(licenseData.customer_name || 'Unknown')}\n` +
                `📧 Email: ${tg(licenseData.customer_email || '-')}\n` +
                `🆕 Attempted Device: <code>${tg(device_id)}</code>\n` +
                `💻 Registered Device: ${tg(licenseData.device_type || '-')}\n` +
                `🌐 IP: ${tg(ip)}`
            );

            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'License has been revoked' },
                { status: 403 }
            );
        }

        // Check if not yet activated
        if (licenseData.status === 'available') {
            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'License not yet activated' },
                { status: 403 }
            );
        }

        // Check device match
        if (licenseData.device_id !== device_id) {
            await logVerification(licenseData.id, device_id, ip, false, 'Device mismatch');

            // Alert for suspicious activity (multiple devices trying same key)
            await notifyAlert(
                `<b>⚠️ VERIFICATION FAILED</b>\n\n` +
                `🔑 Serial: <code>${serial_key}</code>\n` +
                `📦 Product: ${licenseData.product?.name || 'Unknown'}\n` +
                `👤 Name: ${licenseData.customer_name || 'Unknown'}\n` +
                `📧 Email: ${licenseData.customer_email || '-'}\n` +
                `💻 ${licenseData.device_type || '-'}\n` +
                `🖥 Expected Device: <code>${licenseData.device_id || '-'}</code>\n` +
                `🆕 Got Device: <code>${device_id}</code>\n` +
                `🌐 IP: ${ip}`
            );

            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'Device mismatch' },
                { status: 403 }
            );
        }

        // Update last active timestamp
        await supabaseAdmin
            .from('licenses')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', licenseData.id);

        // Log successful verification
        await logVerification(licenseData.id, device_id, ip, true);

        return NextResponse.json<VerifyResponse>({
            valid: true,
            message: 'License valid',
            product_name: licenseData.product?.name,
        });

    } catch (error) {
        console.error('Verify error:', error);
        return NextResponse.json<VerifyResponse>(
            { valid: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function logVerification(
    licenseId: string,
    deviceId: string,
    ip: string,
    success: boolean,
    errorMessage?: string
) {
    await supabaseAdmin.from('activations').insert({
        license_id: licenseId,
        action: 'verify',
        device_id: deviceId,
        ip_address: ip,
        success,
        error_message: errorMessage,
    });
}
