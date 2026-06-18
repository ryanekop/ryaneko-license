import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { escapeTelegramHtml, notifyAlert } from '@/lib/telegram';
import { getEmailHtml, getEmailSubject } from '@/lib/email-templates';
import { sendEmail } from '@/lib/resend';
import type { License } from '@/lib/types';

const tg = (value: unknown) => escapeTelegramHtml(value);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const productSlug = searchParams.get('product');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // First, get the product ID for counting
    let productId: string | null = null;
    if (productSlug) {
        const { data: product } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('slug', productSlug)
            .single();
        productId = product?.id || null;
    }

    // Get total counts for all statuses (independent of filters/pagination)
    let totalAll = 0;
    let availableCount = 0;
    let usedCount = 0;

    if (productId) {
        const [totalRes, availableRes, usedRes] = await Promise.all([
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId),
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'available'),
            supabaseAdmin.from('licenses').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'used'),
        ]);
        totalAll = totalRes.count || 0;
        availableCount = availableRes.count || 0;
        usedCount = usedRes.count || 0;
    }

    // Build filtered query for the current page
    let query = supabaseAdmin
        .from('licenses')
        .select('*, product:products!inner(*)', { count: 'exact' });

    if (productSlug) {
        query = query.eq('product.slug', productSlug);
    }

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    if (search) {
        query = query.or(
            `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,serial_key.ilike.%${search}%,customer_instagram.ilike.%${search}%`
        );
    }

    const dataFilter = searchParams.get('dataFilter');
    if (dataFilter === 'with-data') {
        // Show only licenses that have customer data (used + available with names)
        query = query.or('status.neq.available,customer_name.not.is.null,customer_email.not.is.null,device_type.not.is.null');
    } else if (dataFilter === 'empty') {
        // Show only truly empty serials: available AND no customer data
        query = query.eq('status', 'available').is('customer_name', null).is('customer_email', null).is('device_type', null);
    }
    // 'all' or not provided = no filter

    const deviceFilter = searchParams.get('device');
    if (deviceFilter && deviceFilter !== 'all') {
        // Use ilike to match variants like "Mac (Monterey)" when filtering by "Mac"
        query = query.ilike('device_type', `${deviceFilter}%`);
    }

    const sort = searchParams.get('sort');
    const ascending = sort === 'asc';

    query = query
        .order('updated_at', { ascending })
        .order('id', { ascending })
        .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        licenses: data,
        total: count,
        totalAll,
        availableCount,
        usedCount,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
    });
}

// Update license (change device, reset status, edit table)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, email, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        if (action === 'resend_email') {
            const newEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
            if (!EMAIL_REGEX.test(newEmail)) {
                return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
            }

            const { data: current, error: currentError } = await supabaseAdmin
                .from('licenses')
                .select('*, product:products(*)')
                .eq('id', id)
                .single();

            if (currentError || !current) {
                return NextResponse.json({ error: currentError?.message || 'License not found' }, { status: currentError ? 500 : 404 });
            }

            const selectedLicense = current as License;
            const product = selectedLicense.product;
            if (!product) {
                return NextResponse.json({ error: 'Product not found for this license' }, { status: 400 });
            }

            let purchase: any = null;
            if (selectedLicense.order_id) {
                const { data: purchaseData, error: purchaseError } = await supabaseAdmin
                    .from('purchases')
                    .select('*')
                    .eq('order_id', selectedLicense.order_id)
                    .maybeSingle();

                if (purchaseError) {
                    console.error('[Admin License] Failed to load purchase for resend:', purchaseError);
                } else {
                    purchase = purchaseData;
                }
            }

            const assignedIds = Array.isArray(purchase?.licenses_assigned)
                ? purchase.licenses_assigned.filter((licenseId: unknown): licenseId is string => typeof licenseId === 'string' && licenseId.length > 0)
                : [];

            let licensesToEmail: License[] = [selectedLicense];
            if (assignedIds.length > 0) {
                const { data: assignedLicenses, error: assignedError } = await supabaseAdmin
                    .from('licenses')
                    .select('*, product:products(*)')
                    .in('id', assignedIds);

                if (assignedError) {
                    console.error('[Admin License] Failed to load assigned licenses for resend:', assignedError);
                } else if (assignedLicenses && assignedLicenses.length > 0) {
                    const byId = new Map((assignedLicenses as License[]).map((license) => [license.id, license]));
                    const orderedAssignedLicenses = assignedIds.map((licenseId: string) => byId.get(licenseId)).filter(Boolean) as License[];
                    if (orderedAssignedLicenses.length > 0) {
                        licensesToEmail = orderedAssignedLicenses;
                    }
                }
            }

            const relatedLicenseIds = licensesToEmail.map((license) => license.id);
            const { error: licenseUpdateError } = await supabaseAdmin
                .from('licenses')
                .update({
                    customer_email: newEmail,
                    updated_at: new Date().toISOString(),
                })
                .in('id', relatedLicenseIds);

            if (licenseUpdateError) {
                return NextResponse.json({ error: licenseUpdateError.message }, { status: 500 });
            }

            if (selectedLicense.order_id) {
                const { error: purchaseUpdateError } = await supabaseAdmin
                    .from('purchases')
                    .update({ customer_email: newEmail })
                    .eq('order_id', selectedLicense.order_id);

                if (purchaseUpdateError) {
                    return NextResponse.json({ error: purchaseUpdateError.message }, { status: 500 });
                }
            }

            const includesPlugin = Boolean(purchase?.includes_plugin);
            const customerName = purchase?.customer_name || selectedLicense.customer_name || 'Customer';
            const downloadLinks = (product.download_urls || {}) as Record<string, string>;
            const serialKeys = licensesToEmail.map((license) => license.serial_key).filter(Boolean);
            const html = getEmailHtml(product.slug, {
                customerName,
                serialKeys,
                productName: product.name,
                downloadLinks,
                pluginUrl: product.plugin_url || undefined,
                includesPlugin,
            });
            const subject = getEmailSubject(product.slug, includesPlugin);
            const result = await sendEmail({
                to: newEmail,
                subject,
                html,
            });

            if (!result.success) {
                await notifyAlert(
                    `<b>⚠️ Resend License Email Failed</b>\n\n` +
                    `📦 Product: ${tg(product.name)}\n` +
                    `🔑 Serial: <code>${tg(selectedLicense.serial_key)}</code>\n` +
                    `📧 Email: ${tg(newEmail)}\n` +
                    `❌ Error: ${tg(result.error)}`
                );
                return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 502 });
            }

            return NextResponse.json({
                success: true,
                id: result.id,
                email: newEmail,
                licenseIds: relatedLicenseIds,
            });
        }

        let finalUpdate: Record<string, unknown> = { ...updateData };

        if ('reset_count' in finalUpdate) {
            const rawResetCount = finalUpdate.reset_count;
            if (rawResetCount === '' || rawResetCount === null || rawResetCount === undefined) {
                return NextResponse.json({ error: 'reset_count must be a non-negative integer' }, { status: 400 });
            }
            const resetCount = typeof rawResetCount === 'number' ? rawResetCount : Number(rawResetCount);
            if (!Number.isInteger(resetCount) || resetCount < 0) {
                return NextResponse.json({ error: 'reset_count must be a non-negative integer' }, { status: 400 });
            }
            finalUpdate.reset_count = resetCount;
        }

        // Reset action: clear device data and set to available, keep owner info
        if (action === 'reset') {
            const { data: current, error: currentError } = await supabaseAdmin
                .from('licenses')
                .select('reset_count')
                .eq('id', id)
                .single();

            if (currentError) {
                return NextResponse.json({ error: currentError.message }, { status: 500 });
            }

            finalUpdate = {
                status: 'available',
                device_type: null,
                device_id: null,
                activated_at: null,
                last_active_at: null,
                reset_count: (Number(current?.reset_count) || 0) + 1,
            };
        }

        // Clear all action: clear everything including customer info
        if (action === 'clear') {
            finalUpdate = {
                status: 'available',
                customer_name: null,
                customer_email: null,
                customer_instagram: null,
                device_type: null,
                device_id: null,
                activated_at: null,
                last_active_at: null,
            };
        }

        // Revoke action: block future activation/verification but keep audit details.
        if (action === 'revoke') {
            finalUpdate = {
                status: 'revoked',
            };
        }

        // Unrevoke action: restore validation on the existing device.
        if (action === 'unrevoke') {
            finalUpdate = {
                status: 'used',
            };
        }

        finalUpdate.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('licenses')
            .update(finalUpdate)
            .eq('id', id)
            .select('*, product:products(*)')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (action === 'revoke' || action === 'unrevoke') {
            const { error: logError } = await supabaseAdmin.from('activations').insert({
                license_id: data.id,
                action: 'revoke',
                device_id: data.device_id,
                device_type: data.device_type,
                success: true,
                error_message: action === 'unrevoke' ? 'License unrevoked' : null,
            });

            if (logError) {
                console.error(`Failed to log ${action} action:`, logError);
            }

            const licenseData = data as License;
            await notifyAlert(
                `<b>${action === 'unrevoke' ? 'LICENSE UNREVOKED' : 'LICENSE REVOKED'}</b>\n\n` +
                `🔑 Serial: <code>${tg(licenseData.serial_key)}</code>\n` +
                `📦 Product: ${tg(licenseData.product?.name || 'Unknown')}\n` +
                `👤 Name: ${tg(licenseData.customer_name || 'Unknown')}\n` +
                `📧 Email: ${tg(licenseData.customer_email || '-')}\n` +
                `💻 Device: ${tg(licenseData.device_type || '-')}\n` +
                `🖥 Device ID: <code>${tg(licenseData.device_id || '-')}</code>\n` +
                `🆔 License ID: <code>${tg(licenseData.id)}</code>`
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// Delete = Clear info (name, email, device, etc.) but keep the serial
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing license ID' }, { status: 400 });
        }

        // Clear info instead of deleting the serial or audit history.
        const { data, error } = await supabaseAdmin
            .from('licenses')
            .update({
                customer_name: null,
                customer_email: null,
                customer_instagram: null,
                device_type: null,
                device_id: null,
                status: 'available',
                activated_at: null,
                last_active_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
