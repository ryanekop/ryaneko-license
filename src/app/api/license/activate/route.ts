import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateDeviceHash, verifyHash } from '@/lib/crypto';
import { notifyActivation, notifyAlert } from '@/lib/telegram';
import type { ActivationRequest, ActivationResponse, License } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const body: ActivationRequest = await request.json();
        const { serial_key, device_id, device_type, os_version } = body;

        // Validate required fields
        if (!serial_key || !device_id || !device_type) {
            return NextResponse.json<ActivationResponse>(
                { success: false, message: 'Missing required fields' },
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
            // Log failed attempt
            console.log(`Activation failed: Invalid serial key ${serial_key.substring(0, 8)}...`);

            return NextResponse.json<ActivationResponse>(
                { success: false, message: 'Invalid serial key' },
                { status: 404 }
            );
        }

        const licenseData = license as License & { product: { name: string } };

        // Check if license is revoked
        if (licenseData.status === 'revoked') {
            await logActivation(licenseData.id, 'activate', device_id, device_type, os_version, ip, false, 'License revoked');

            return NextResponse.json<ActivationResponse>(
                { success: false, message: 'License has been revoked' },
                { status: 403 }
            );
        }

        // Check if already activated on different device
        if (licenseData.status === 'used' && licenseData.device_id) {
            if (licenseData.device_id !== device_id) {
                // Suspicious: trying to activate on different device
                await logActivation(licenseData.id, 'activate', device_id, device_type, os_version, ip, false, 'Already activated on another device');

                await notifyAlert(
                    `<b>⚠️ ACTIVATION BLOCKED</b>\n\n` +
                    `Serial: ${serial_key.substring(0, 8)}...\n` +
                    `Product: ${licenseData.product?.name || 'Unknown'}\n` +
                    `Existing Device: ${licenseData.device_id.substring(0, 8)}...\n` +
                    `New Device: ${device_id.substring(0, 8)}...\n` +
                    `Type: ${device_type}\n` +
                    `IP: ${ip}`
                );

                return NextResponse.json<ActivationResponse>(
                    { success: false, message: 'License already activated on another device' },
                    { status: 403 }
                );
            }

            // Same device, just verify
            await logActivation(licenseData.id, 'activate', device_id, device_type, os_version, ip, true);

            // Update last active
            await supabaseAdmin
                .from('licenses')
                .update({ last_active_at: new Date().toISOString() })
                .eq('id', licenseData.id);

            return NextResponse.json<ActivationResponse>({
                success: true,
                message: 'License already activated on this device',
                license_id: licenseData.id,
                product_name: licenseData.product?.name,
                activated_at: licenseData.activated_at,
            });
        }

        // New activation
        const deviceHash = generateDeviceHash(serial_key, device_id);
        const now = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
            .from('licenses')
            .update({
                status: 'used',
                device_type,
                device_id,
                device_hash: deviceHash,
                activated_at: now,
                last_active_at: now,
            })
            .eq('id', licenseData.id);

        if (updateError) {
            console.error('Failed to update license:', updateError);
            return NextResponse.json<ActivationResponse>(
                { success: false, message: 'Failed to activate license' },
                { status: 500 }
            );
        }

        // Log successful activation
        await logActivation(licenseData.id, 'activate', device_id, device_type, os_version, ip, true);

        // Notify admin
        await notifyActivation(
            `<b>License Activated</b>\n\n` +
            `📦 ${licenseData.product?.name || 'Unknown'}\n` +
            `🔑 ${serial_key.substring(0, 8)}...\n` +
            `💻 ${device_type}\n` +
            `👤 ${licenseData.customer_name || 'Unknown'}`
        );

        return NextResponse.json<ActivationResponse>({
            success: true,
            message: 'License activated successfully',
            license_id: licenseData.id,
            product_name: licenseData.product?.name,
            activated_at: now,
        });

    } catch (error) {
        console.error('Activation error:', error);
        return NextResponse.json<ActivationResponse>(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function logActivation(
    licenseId: string,
    action: string,
    deviceId: string,
    deviceType: string,
    osVersion: string | undefined,
    ip: string,
    success: boolean,
    errorMessage?: string
) {
    await supabaseAdmin.from('activations').insert({
        license_id: licenseId,
        action,
        device_id: deviceId,
        device_type: deviceType,
        os_version: osVersion,
        ip_address: ip,
        success,
        error_message: errorMessage,
    });
}
