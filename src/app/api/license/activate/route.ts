import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateDeviceHash } from '@/lib/crypto';
import { escapeTelegramHtml, notifyActivation, notifyAlert } from '@/lib/telegram';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import type { ActivationRequest, ActivationResponse, License } from '@/lib/types';

// 10 requests per minute per IP (strict — activation is a rare action)
const activateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const tg = (value: unknown) => escapeTelegramHtml(value);

/**
 * Normalize device_type from OS-reported values to consistent display format.
 * e.g. "macOS" → "Mac", "macOS-Monterey" → "Mac (Monterey)", "Windows" → "Windows", "Android 14" → "Android"
 */
function normalizeDeviceType(raw: string): string {
    if (!raw) return raw;
    const lower = raw.toLowerCase().trim();

    // macOS variants: "macos", "macos-monterey", "macos-ventura", etc.
    if (lower.startsWith('macos') || lower.startsWith('mac os')) {
        // Check for version suffix like "macOS-Monterey" or "macOS Monterey"
        const match = raw.match(/^mac\s*os[\s\-_]*(.+)$/i);
        if (match && match[1]) {
            const version = match[1].trim();
            return `Mac (${version.charAt(0).toUpperCase() + version.slice(1)})`;
        }
        return 'Mac';
    }

    // Already "Mac" or "Mac (something)"
    if (lower === 'mac' || lower.startsWith('mac (')) {
        return raw;
    }

    // Windows stays as-is
    if (lower.startsWith('windows')) {
        return 'Windows';
    }

    // Android variants are grouped into one admin filter category.
    if (lower.startsWith('android')) {
        return 'Android';
    }

    return raw;
}

export async function POST(request: NextRequest) {
    try {
        // Rate limit check
        const ip = getClientIp(request);
        const { allowed, retryAfterMs } = activateLimiter.check(ip);
        if (!allowed) {
            return rateLimitResponse(retryAfterMs);
        }

        const body: ActivationRequest = await request.json();
        const { serial_key, device_id, device_type: rawDeviceType, os_version } = body;

        // Validate required fields
        if (!serial_key || !device_id || !rawDeviceType) {
            return NextResponse.json<ActivationResponse>(
                { success: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Normalize device type for consistent display
        const device_type = normalizeDeviceType(rawDeviceType);

        // ip already extracted via getClientIp() above

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

            await notifyAlert(
                `<b>🚫 REVOKED LICENSE BLOCKED</b>\n\n` +
                `⚙️ Action: activate\n` +
                `🔑 Serial: <code>${tg(serial_key)}</code>\n` +
                `📦 Product: ${tg(licenseData.product?.name || 'Unknown')}\n` +
                `👤 Name: ${tg(licenseData.customer_name || 'Unknown')}\n` +
                `📧 Email: ${tg(licenseData.customer_email || '-')}\n` +
                `🆕 Attempted Device: <code>${tg(device_id)}</code>\n` +
                `💻 ${tg(device_type)}${os_version ? ' · ' + tg(os_version) : ''}\n` +
                `🌐 IP: ${tg(ip)}`
            );

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
                    `🔑 Serial: <code>${serial_key}</code>\n` +
                    `📦 Product: ${licenseData.product?.name || 'Unknown'}\n` +
                    `👤 Name: ${licenseData.customer_name || 'Unknown'}\n` +
                    `📧 Email: ${licenseData.customer_email || '-'}\n` +
                    `🖥 Existing Device: <code>${licenseData.device_id}</code>\n` +
                    `🆕 New Device: <code>${device_id}</code>\n` +
                    `💻 ${device_type}${os_version ? ' · ' + os_version : ''}\n` +
                    `🌐 IP: ${ip}`
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
                updated_at: now,
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
            `🔑 <code>${serial_key}</code>\n` +
            `💻 ${device_type}${os_version ? ' · ' + os_version : ''}\n` +
            `👤 ${licenseData.customer_name || 'Unknown'}\n` +
            `📧 ${licenseData.customer_email || '-'}\n` +
            `🌐 IP: ${ip}`
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
