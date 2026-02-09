import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyAlert } from '@/lib/telegram';
import type { VerifyRequest, VerifyResponse, License } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const body: VerifyRequest = await request.json();
        const { serial_key, device_id } = body;

        // Validate required fields
        if (!serial_key || !device_id) {
            return NextResponse.json<VerifyResponse>(
                { valid: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get client IP
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

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
                `Serial: ${serial_key.substring(0, 8)}...\n` +
                `Product: ${licenseData.product?.name || 'Unknown'}\n` +
                `Expected: ${licenseData.device_id?.substring(0, 8)}...\n` +
                `Got: ${device_id.substring(0, 8)}...\n` +
                `IP: ${ip}`
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
