import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { notifyPurchase, notifyAlert } from '@/lib/telegram';
import { sendEmail } from '@/lib/resend';
import { getEmailHtml, getEmailSubject } from '@/lib/email-templates';
import { generateHash } from '@/lib/crypto';
import type {
    MayarWebhookPayload,
    MayarOrderData,
    Product,
    License,
    DeviceType
} from '@/lib/types';

// Response helper
function jsonResponse(status: string, message: string, statusCode = 200) {
    return NextResponse.json({ status, message }, { status: statusCode });
}

// =============================================
// PRODUCT DETECTION
// =============================================

// Detect product from product name (for software licenses)
async function detectProduct(productName: string): Promise<Product | null> {
    const { data: products } = await supabaseAdmin
        .from('products')
        .select('*');

    if (!products) return null;

    const lowerName = productName.toLowerCase();

    for (const product of products) {
        const keywords = product.detection_keywords || [];
        for (const keyword of keywords) {
            if (lowerName.includes(keyword.toLowerCase())) {
                return product as Product;
            }
        }
    }

    return null;
}

// Check if product name matches Fastpik
function isFastpikProduct(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    const fastpikKeywords = ['fastpik', 'fast pik', 'fast-pik'];
    return fastpikKeywords.some(keyword => lowerName.includes(keyword));
}

// =============================================
// FASTPIK SUBSCRIPTION HANDLER
// =============================================

async function handleFastpikSubscription(
    orderData: MayarOrderData,
    payload: MayarWebhookPayload
): Promise<NextResponse> {
    const fastpikSupabase = getFastpikSupabase();
    const FASTPIK_SITE_URL = process.env.FASTPIK_SITE_URL || 'https://fastpik.ryanekoapp.web.id';

    const data = payload.data || payload;
    const rawStatus = (data as any).status || (payload as any).status;

    // Extract customer info
    const customer = (data as any).customer || (data as any).customerDetail || (payload as any).customer || {};
    const email =
        orderData.customerEmail ||
        orderData.customer_email ||
        (data as any).customerEmail ||
        (payload as any).customerEmail ||
        customer.email ||
        (data as any).email ||
        (payload as any).email;

    const name =
        orderData.customerName ||
        orderData.customer_name ||
        (data as any).customerName ||
        (payload as any).customerName ||
        customer.name ||
        customer.fullName ||
        (data as any).name ||
        (payload as any).name ||
        'User';

    const amount = (data as any).amount || (data as any).totalAmount || (data as any).gross_amount || (payload as any).amount || 0;
    const transactionId = orderData.id || (data as any).transactionId || (payload as any).id || `TRX-${Date.now()}`;

    console.log(`[Fastpik Webhook] Email: ${email}, Name: ${name}, Status: ${rawStatus}, Amount: ${amount}`);

    if (!email) {
        console.error('[Fastpik Webhook] No email found in payload');
        return jsonResponse('Error', 'No email provided', 400);
    }

    // Check payment status
    const statusStr = rawStatus?.toString().toLowerCase();
    const isSuccess = rawStatus === true ||
        ['success', 'settlement', 'paid', 'successful'].includes(statusStr);

    if (!isSuccess) {
        return jsonResponse('Success', `Ignored status: ${rawStatus}`);
    }

    // Determine plan from amount
    let planDurationDays = 0;
    let planTier = 'free';
    let isLifetime = false;
    const amountNum = Number(amount);

    if (amountNum >= 14000 && amountNum <= 16000) {
        planTier = 'pro_monthly';
        planDurationDays = 30;
    } else if (amountNum >= 38000 && amountNum <= 40000) {
        planTier = 'pro_quarterly';
        planDurationDays = 90;
    } else if (amountNum >= 128000 && amountNum <= 130000) {
        planTier = 'pro_yearly';
        planDurationDays = 365;
    } else if (amountNum >= 348000 && amountNum <= 350000) {
        planTier = 'lifetime';
        isLifetime = true;
    } else {
        console.log(`[Fastpik Webhook] Unknown amount: ${amountNum}`);
        return jsonResponse('Success', `Unknown amount: ${amountNum}`);
    }

    // Find or Create User in Fastpik Supabase
    let userId: string | undefined;
    const { data: newUser, error: createError } = await fastpikSupabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { full_name: name }
    });

    if (createError) {
        // User already exists — find them
        const { data: { users: allUsers } } = await fastpikSupabase.auth.admin.listUsers({ perPage: 1000 });
        const found = allUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
            userId = found.id;
            // Send magic link for existing user
            try {
                await fastpikSupabase.auth.signInWithOtp({
                    email: email,
                    options: {
                        emailRedirectTo: `${FASTPIK_SITE_URL}/id/auth/callback?next=/id/dashboard`
                    }
                });
            } catch (e) {
                console.error('[Fastpik Webhook] Failed to send OTP:', e);
            }
        }
    } else {
        userId = newUser.user.id;
        // Send password reset for new user
        try {
            await fastpikSupabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${FASTPIK_SITE_URL}/id/auth/callback?type=recovery`
            });
        } catch (e) {
            console.error('[Fastpik Webhook] Failed to send password reset:', e);
        }
    }

    if (!userId) {
        return jsonResponse('Error', 'User ID error', 500);
    }

    // Calculate dates
    const startDate = new Date();
    let endDate = null;
    if (!isLifetime) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + planDurationDays);
        endDate = end.toISOString();
    }

    // Upsert subscription
    const { error: upsertError } = await fastpikSupabase
        .from('subscriptions')
        .upsert({
            user_id: userId,
            tier: planTier,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate,
            mayar_transaction_id: transactionId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (upsertError) {
        console.error('[Fastpik Webhook] Subscription upsert error:', upsertError);
        throw upsertError;
    }

    // Telegram notification
    await notifyPurchase(
        `<b>Fastpik Purchase!</b>\n\n` +
        `📦 ${planTier}\n` +
        `👤 ${name}\n` +
        `📧 ${email}\n` +
        `💰 Rp ${amountNum.toLocaleString('id-ID')}\n` +
        `🔑 Transaction: ${transactionId}`
    );

    console.log(`[Fastpik Webhook] ✅ Subscription activated: ${email} -> ${planTier}`);
    return jsonResponse('Success', `Fastpik subscription activated: ${planTier}`);
}

// =============================================
// SOFTWARE LICENSE HANDLER (EXISTING LOGIC)
// =============================================

// Parse addons for extra licenses and plugin
function parseAddons(addons: unknown[]): { extraLicenses: number; includesPlugin: boolean } {
    let extraLicenses = 0;
    let includesPlugin = false;

    if (!Array.isArray(addons)) return { extraLicenses, includesPlugin };

    for (const item of addons) {
        let itemName = '';
        if (typeof item === 'object' && item !== null) {
            const addon = item as { productName?: string; name?: string };
            itemName = addon.productName || addon.name || '';
        } else {
            itemName = String(item);
        }

        const lowerName = itemName.toLowerCase();

        // Extra license detection
        if (lowerName.includes('jadi 3') || lowerName.includes('extra 2')) {
            extraLicenses += 2;
        } else if (lowerName.includes('jadi 2') || lowerName.includes('extra 1')) {
            extraLicenses += 1;
        }

        // Plugin detection
        if (lowerName.includes('plugin') || lowerName.includes('lightroom')) {
            includesPlugin = true;
        }
    }

    return { extraLicenses, includesPlugin };
}

// Detect device type from OS version (for RAW File Copy Tool)
function detectDeviceType(platform: string, osVersion: string): DeviceType {
    if (platform.toLowerCase().includes('windows')) {
        return 'Windows';
    }

    // Check for Monterey (macOS 12.x)
    if (osVersion && osVersion.toLowerCase().includes('monterey')) {
        return 'macOS-Monterey';
    }

    // Check version number for Monterey
    const versionMatch = osVersion?.match(/(\d+)\.(\d+)/);
    if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1], 10);
        if (majorVersion === 12) {
            return 'macOS-Monterey';
        }
    }

    return 'macOS';
}

// Reserve licenses for a purchase
async function reserveLicenses(
    productId: string,
    count: number,
    customerName: string,
    customerEmail: string,
    orderId: string
): Promise<License[]> {
    const reservedLicenses: License[] = [];

    // Find available licenses
    const { data: availableLicenses, error } = await supabaseAdmin
        .from('licenses')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'available')
        .is('customer_name', null)
        .order('created_at', { ascending: true })
        .limit(count);

    if (error || !availableLicenses || availableLicenses.length === 0) {
        return [];
    }

    // Reserve each license
    for (let i = 0; i < Math.min(count, availableLicenses.length); i++) {
        const license = availableLicenses[i];
        const batchInfo = count > 1 ? `Batch ${i + 1}/${count}` : null;

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('licenses')
            .update({
                customer_name: customerName,
                customer_email: customerEmail,
                order_id: orderId,
                batch_info: batchInfo,
            })
            .eq('id', license.id)
            .select()
            .single();

        if (!updateError && updated) {
            reservedLicenses.push(updated as License);
        }
    }

    return reservedLicenses;
}

// Send license email via Resend
async function sendLicenseEmail(
    email: string,
    name: string,
    licenses: License[],
    product: Product,
    includesPlugin: boolean
): Promise<boolean> {
    try {
        const downloadLinks = (product.download_urls || {}) as Record<string, string>;
        const serialKeys = licenses.map(l => l.serial_key).filter(Boolean);

        const html = getEmailHtml(product.slug, {
            customerName: name,
            serialKeys,
            productName: product.name,
            downloadLinks,
            pluginUrl: product.plugin_url || undefined,
            includesPlugin,
        });

        const subject = getEmailSubject(product.slug, includesPlugin);

        const result = await sendEmail({
            to: email,
            subject,
            html,
        });

        if (!result.success) {
            console.error(`[License Email] Failed to send to ${email}:`, result.error);
            await notifyAlert(
                `<b>⚠️ Email Failed</b>\n\n` +
                `Product: ${product.name}\n` +
                `Email: ${email}\n` +
                `Error: ${result.error}`
            );
            return false;
        }

        console.log(`[License Email] ✅ Sent to ${email} for ${product.name}`);
        return true;
    } catch (err: any) {
        console.error('[License Email] Error:', err);
        return false;
    }
}

async function handleLicensePurchase(
    orderData: MayarOrderData,
    payload: MayarWebhookPayload,
    product: Product
): Promise<NextResponse> {
    const customerEmail = orderData.customerEmail || orderData.customer_email;
    const customerName = orderData.customerName || orderData.customer_name || 'Customer';
    const productName = orderData.productName || orderData.product_name || '';
    const addons = orderData.addOn || orderData.addons || orderData.items || [];

    console.log(`Detected Product: ${product.name} (${product.slug})`);

    // Check for plugin-only purchase (skip license assignment)
    const lowerProductName = productName.toLowerCase();
    const isBundle = lowerProductName.includes('bundle');
    const isPluginOnly = lowerProductName.includes('plugin') && !isBundle;

    if (isPluginOnly) {
        console.log('Plugin-only purchase, handled by Mayar');
        return jsonResponse('Success', 'Plugin purchase - no license needed');
    }

    // Parse addons
    const { extraLicenses, includesPlugin } = parseAddons(addons);
    const totalLicenses = 1 + extraLicenses;

    console.log(`Total Licenses Needed: ${totalLicenses}, Includes Plugin: ${includesPlugin || isBundle}`);

    // Reserve licenses
    const reservedLicenses = await reserveLicenses(
        product.id,
        totalLicenses,
        customerName,
        customerEmail!,
        orderData.id
    );

    console.log(`Reserved ${reservedLicenses.length}/${totalLicenses} licenses`);

    // Out of stock alert
    if (reservedLicenses.length < totalLicenses) {
        await notifyAlert(
            `<b>⚠️ LICENSE SHORTAGE</b>\n\n` +
            `Product: ${product.name}\n` +
            `Order: ${orderData.id}\n` +
            `Customer: ${customerEmail}\n` +
            `Needed: ${totalLicenses}\n` +
            `Available: ${reservedLicenses.length}`
        );
    }

    if (reservedLicenses.length === 0) {
        return jsonResponse('Error', 'Out of stock - Admin notified', 500);
    }

    // Record purchase
    const { error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .insert({
            order_id: orderData.id,
            product_id: product.id,
            customer_name: customerName,
            customer_email: customerEmail,
            license_count: totalLicenses,
            includes_plugin: includesPlugin || isBundle,
            addons: addons,
            raw_payload: payload,
            licenses_assigned: reservedLicenses.map(l => l.id),
        });

    if (purchaseError) {
        console.error('Failed to record purchase:', purchaseError);
    }

    // Send email
    await sendLicenseEmail(
        customerEmail!,
        customerName,
        reservedLicenses,
        product,
        includesPlugin || isBundle
    );

    // Telegram notification
    await notifyPurchase(
        `<b>New Purchase!</b>\n\n` +
        `📦 ${product.name}\n` +
        `👤 ${customerName}\n` +
        `📧 ${customerEmail}\n` +
        `🔑 ${reservedLicenses.length} license(s)\n` +
        `${includesPlugin || isBundle ? '🔌 + Plugin' : ''}`
    );

    return jsonResponse('Success', `Assigned ${reservedLicenses.length} license(s)`);
}

// =============================================
// MAIN WEBHOOK ROUTER
// =============================================

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        console.log('[Mayar Webhook] Received:', rawBody);

        let payload: MayarWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return jsonResponse('Error', 'Invalid JSON', 400);
        }

        // Test webhook
        if (payload.event === 'testing' || payload.event === 'test') {
            console.log('Test webhook received');
            return jsonResponse('Success', 'Webhook URL verified');
        }

        // Only process payment.received events
        const eventType = payload.event || '';
        if (eventType && eventType !== 'payment.received') {
            console.log(`[Mayar Webhook] Ignoring event: ${eventType}`);
            return jsonResponse('Success', `Ignored event: ${eventType}`);
        }

        // Get order data (either from data wrapper or direct)
        const orderData: MayarOrderData = payload.data || {
            id: payload.id || '',
            productName: payload.productName || payload.product_name,
            customerName: payload.customerName || payload.customer_name,
            customerEmail: payload.customerEmail || payload.customer_email,
            addOn: payload.addOn || payload.addons || payload.items,
        };

        // Validate required fields
        if (!orderData.id) {
            return jsonResponse('Error', 'Missing order ID', 400);
        }

        const customerEmail = orderData.customerEmail || orderData.customer_email;
        if (!customerEmail) {
            return jsonResponse('Error', 'Missing customer email', 400);
        }

        const productName = orderData.productName || orderData.product_name || '';

        // ========================================
        // ROUTING: Fastpik vs Software License
        // ========================================

        // 1. Check if this is a Fastpik subscription purchase
        if (isFastpikProduct(productName)) {
            console.log(`[Mayar Webhook] ➡️ Routing to Fastpik handler for: ${productName}`);
            return await handleFastpikSubscription(orderData, payload);
        }

        // 2. Check if this is a software license purchase
        const product = await detectProduct(productName);
        if (product) {
            console.log(`[Mayar Webhook] ➡️ Routing to License handler for: ${productName}`);
            return await handleLicensePurchase(orderData, payload, product);
        }

        // 3. Unknown product — log and return success to not block webhook
        console.log(`[Mayar Webhook] ❓ Unknown product: ${productName}`);
        await notifyAlert(
            `<b>⚠️ Unknown Product in Webhook</b>\n\n` +
            `Product: ${productName}\n` +
            `Email: ${customerEmail}\n` +
            `Order: ${orderData.id}`
        );

        return jsonResponse('Success', `Product not managed: ${productName}`);

    } catch (error) {
        console.error('[Mayar Webhook] Error:', error);
        return jsonResponse('Error', String(error), 500);
    }
}

// Health check
export async function GET() {
    return NextResponse.json({
        status: 'OK',
        message: 'Unified Mayar Webhook — Ryaneko License + Fastpik',
        version: '2.0',
        supportedProducts: ['raw-file-copy-tool', 'realtime-upload-pro', 'photo-split-express', 'fastpik'],
    });
}
