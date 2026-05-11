import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { escapeTelegramHtml, notifyPurchase, notifyAlert } from '@/lib/telegram';
import { sendEmail } from '@/lib/resend';
import { getEmailHtml, getEmailSubject } from '@/lib/email-templates';
import { generateHash } from '@/lib/crypto';
import type {
    MayarWebhookPayload,
    MayarOrderData,
    MayarCustomField,
    Product,
    License
} from '@/lib/types';

// Response helper
function jsonResponse(status: string, message: string, statusCode = 200) {
    return NextResponse.json({ status, message }, { status: statusCode });
}

const tg = (value: unknown) => escapeTelegramHtml(value);

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
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

// Extract Instagram username from Mayar custom_field
function extractInstagram(customFields?: MayarCustomField[]): string | null {
    if (!Array.isArray(customFields)) return null;
    for (const field of customFields) {
        if (field.name?.toLowerCase().includes('instagram') && typeof field.value === 'string') {
            // Remove @ prefix if present, we'll add it on display
            return field.value.replace(/^@/, '').trim() || null;
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

// Check if product name matches Client Desk
function isClientDeskProduct(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    const clientDeskKeywords = ['client desk', 'clientdesk', 'client-desk'];
    return clientDeskKeywords.some(keyword => lowerName.includes(keyword));
}

type ClientDeskPlanTier = 'pro_monthly' | 'pro_quarterly' | 'pro_yearly' | 'lifetime';
type SubscriptionHistoryEventType = 'purchased' | 'renewed' | 'changed';

type ExistingSubscription = {
    id: string;
    user_id: string;
    tier: ClientDeskPlanTier | 'free' | string;
    status: 'active' | 'expired' | 'trial' | string;
    end_date: string | null;
    trial_end_date: string | null;
    mayar_transaction_id: string | null;
};

const BUNDLE_KEYWORDS = ['bundle', 'bundling'];

function isClientDeskFastpikBundle(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    const hasBundleKeyword = BUNDLE_KEYWORDS.some((keyword) => lowerName.includes(keyword));
    return hasBundleKeyword && isClientDeskProduct(productName) && isFastpikProduct(productName);
}

const CLIENT_DESK_PLAN_PRICES: Record<ClientDeskPlanTier, number> = {
    pro_monthly: 39000,
    pro_quarterly: 105000,
    pro_yearly: 389000,
    lifetime: 549000,
};

const CLIENT_DESK_MIN_PRICE_RATIO = 0.5;
const CLIENT_DESK_AMOUNT_TOLERANCE = 1000;

const FASTPIK_TIER_PRICE_POINTS: Record<ClientDeskPlanTier, number[]> = {
    pro_monthly: [15000],
    pro_quarterly: [39000],
    pro_yearly: [109650, 149000],
    lifetime: [349000],
};

const FASTPIK_AMOUNT_TOLERANCE = 1000;

const BUNDLE_PLAN_PRICES: Record<ClientDeskPlanTier, number> = {
    pro_monthly: 49000,
    pro_quarterly: 129000,
    pro_yearly: 489000,
    lifetime: 749000,
};

const BUNDLE_AMOUNT_TOLERANCE = 2000;

function validateClientDeskAmountForTier(tier: ClientDeskPlanTier, amount: number) {
    const basePrice = CLIENT_DESK_PLAN_PRICES[tier];
    const minAllowed = Math.floor(basePrice * CLIENT_DESK_MIN_PRICE_RATIO);
    const maxAllowed = basePrice + CLIENT_DESK_AMOUNT_TOLERANCE;
    const isValid = Number.isFinite(amount) && amount >= minAllowed && amount <= maxAllowed;

    return {
        isValid,
        basePrice,
        minAllowed,
        maxAllowed,
    };
}

function parseAmountNumber(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.round(value) : NaN;
    }

    if (typeof value === 'string') {
        const sanitized = value.trim().replace(/[^0-9.,-]/g, '');
        if (!sanitized) return NaN;

        const isNegative = sanitized.startsWith('-');
        const unsigned = sanitized.replace(/-/g, '');
        if (!unsigned) return NaN;

        const commaCount = (unsigned.match(/,/g) || []).length;
        const dotCount = (unsigned.match(/\./g) || []).length;
        const isThousandsGrouped = (separator: ',' | '.') => {
            const escaped = separator === '.' ? '\\.' : ',';
            return new RegExp(`^\\d{1,3}(${escaped}\\d{3})+$`).test(unsigned);
        };

        let normalized = unsigned;

        if (commaCount > 0 && dotCount > 0) {
            const lastComma = unsigned.lastIndexOf(',');
            const lastDot = unsigned.lastIndexOf('.');
            const decimalSeparator = lastComma > lastDot ? ',' : '.';
            const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

            normalized = unsigned.split(thousandsSeparator).join('');
            if (decimalSeparator === ',') {
                normalized = normalized.replace(',', '.');
            } else {
                normalized = normalized.replace(/,/g, '');
            }
        } else if (commaCount > 0) {
            normalized = isThousandsGrouped(',') ? unsigned.replace(/,/g, '') : unsigned.replace(/,/g, '.');
        } else if (dotCount > 0) {
            normalized = isThousandsGrouped('.') ? unsigned.replace(/\./g, '') : unsigned;
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return NaN;

        const signed = isNegative ? -parsed : parsed;
        return Math.round(signed);
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function formatAmountIdr(value: unknown): string {
    const parsed = parseAmountNumber(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString('id-ID') : tg(value ?? '-');
}

function detectClientDeskPlanFromAmount(amount: number): ClientDeskPlanTier | null {
    if (!Number.isFinite(amount)) return null;

    const tiers: ClientDeskPlanTier[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
    const validCandidates = tiers
        .map((tier) => {
            const validation = validateClientDeskAmountForTier(tier, amount);
            return {
                tier,
                validation,
                distance: Math.abs(amount - validation.basePrice),
            };
        })
        .filter((candidate) => candidate.validation.isValid);

    if (validCandidates.length === 0) {
        return null;
    }

    validCandidates.sort((a, b) => a.distance - b.distance);
    return validCandidates[0].tier;
}

function detectBundleTierFromAmount(amount: number): ClientDeskPlanTier | null {
    if (!Number.isFinite(amount)) return null;

    const tiers: ClientDeskPlanTier[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
    const candidates = tiers
        .map((tier) => ({
            tier,
            basePrice: BUNDLE_PLAN_PRICES[tier],
            distance: Math.abs(amount - BUNDLE_PLAN_PRICES[tier]),
        }))
        .filter((candidate) => candidate.distance <= BUNDLE_AMOUNT_TOLERANCE);

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].tier;
}

function detectFastpikPlanFromAmount(amount: number): ClientDeskPlanTier | null {
    if (!Number.isFinite(amount)) return null;

    const tiers: ClientDeskPlanTier[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
    const candidates = tiers
        .flatMap((tier) =>
            FASTPIK_TIER_PRICE_POINTS[tier].map((pricePoint) => ({
                tier,
                pricePoint,
                distance: Math.abs(amount - pricePoint),
            }))
        )
        .filter((candidate) => candidate.distance <= FASTPIK_AMOUNT_TOLERANCE);

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].tier;
}

function getClientDeskPlanDurationDays(tier: ClientDeskPlanTier): number {
    if (tier === 'pro_monthly') return 30;
    if (tier === 'pro_quarterly') return 90;
    if (tier === 'pro_yearly') return 365;
    return 0;
}

function isPaymentSuccess(rawStatus: unknown): boolean {
    const statusStr = rawStatus?.toString().toLowerCase();
    return rawStatus === true || ['success', 'settlement', 'paid', 'successful'].includes(statusStr || '');
}

function resolveSubscriptionDates(tier: ClientDeskPlanTier) {
    const startDate = new Date();
    const isLifetime = tier === 'lifetime';
    let endDate: string | null = null;

    if (!isLifetime) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + getClientDeskPlanDurationDays(tier));
        endDate = end.toISOString();
    }

    return {
        startDate: startDate.toISOString(),
        endDate,
    };
}

function resolveSubscriptionHistoryEvent(
    existing: ExistingSubscription | null,
    nextTier: ClientDeskPlanTier
): SubscriptionHistoryEventType {
    const existingTier = existing?.tier || '';
    const hadPaidPlan =
        existing?.status === 'active' &&
        (existingTier === 'lifetime' || existingTier.startsWith('pro_'));

    if (!hadPaidPlan) return 'purchased';
    return existingTier === nextTier ? 'renewed' : 'changed';
}

async function hasTransactionInSubscriptionHistory(supabase: any, transactionId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('subscription_history')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_id', transactionId);

    if (error) {
        console.error('[Mayar Webhook] Failed to check subscription history transaction:', error);
        return false;
    }

    return (count || 0) > 0;
}

async function insertSubscriptionHistory(params: {
    supabase: any;
    userId: string;
    subscriptionId: string | null;
    eventType: SubscriptionHistoryEventType;
    tier: ClientDeskPlanTier;
    periodStart: string;
    periodEnd: string | null;
    amount: number;
    transactionId: string;
    metadata: Record<string, unknown>;
}) {
    const {
        supabase,
        userId,
        subscriptionId,
        eventType,
        tier,
        periodStart,
        periodEnd,
        amount,
        transactionId,
        metadata,
    } = params;

    const alreadyExists = await hasTransactionInSubscriptionHistory(supabase, transactionId);
    if (alreadyExists) return false;

    const { error } = await supabase
        .from('subscription_history')
        .insert({
            user_id: userId,
            subscription_id: subscriptionId,
            event_type: eventType,
            tier,
            status: 'active',
            period_start: periodStart,
            period_end: periodEnd,
            amount,
            currency: 'IDR',
            transaction_id: transactionId,
            metadata,
        });

    if (error) {
        const duplicateCode = (error as { code?: string }).code;
        if (duplicateCode === '23505') return false;
        throw new Error(`[Mayar Webhook] Subscription history insert failed: ${error.message}`);
    }

    return true;
}

async function hasTransactionInSubscriptions(supabase: any, transactionId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('subscriptions')
        .select('user_id', { count: 'exact', head: true })
        .eq('mayar_transaction_id', transactionId);

    if (error) {
        console.error('[Bundle Webhook] Failed to check transaction idempotency:', error);
        return false;
    }

    return (count || 0) > 0;
}

async function getSubscriptionByUserId(supabase: any, userId: string) {
    const { data } = await supabase
        .from('subscriptions')
        .select('id, user_id, tier, status, end_date, trial_end_date, mayar_transaction_id')
        .eq('user_id', userId)
        .maybeSingle();
    return data as ExistingSubscription | null;
}

async function findUserIdByEmail(supabase: any, email: string): Promise<string | null> {
    let page = 1;
    while (true) {
        const { data: authData, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) {
            console.error('[Bundle Webhook] Failed to list users by email:', error);
            return null;
        }

        const users = authData?.users || [];
        const found = users.find((user: any) => user.email?.toLowerCase() === email.toLowerCase());
        if (found) return found.id;
        if (users.length < 1000) break;
        page += 1;
    }

    return null;
}

type BundleApp = 'clientdesk' | 'fastpik';

async function notifyAuthEmailFailure(params: {
    appLabel: string;
    emailFlow: 'OTP' | 'Password Reset';
    email: string;
    name: string;
    transactionId: string;
    error: unknown;
}) {
    const { appLabel, emailFlow, email, name, transactionId, error } = params;
    await notifyAlert(
        `<b>⚠️ ${tg(appLabel)}: ${emailFlow} Failed</b>\n\n` +
        `👤 ${tg(name)}\n` +
        `📧 ${tg(email)}\n` +
        `🧾 Order: ${tg(transactionId)}\n` +
        `❌ ${tg(toErrorMessage(error))}`
    );
}

async function ensureBundleUser(params: {
    app: BundleApp;
    supabase: any;
    email: string;
    name: string;
    siteUrl: string;
    transactionId: string;
}) {
    const { app, supabase, email, name, siteUrl, transactionId } = params;

    let userId: string | null = null;
    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
    });

    if (createError) {
        userId = await findUserIdByEmail(supabase, email);
        if (!userId) {
            throw new Error(`[Bundle Webhook] Failed to find existing ${app} user: ${createError.message}`);
        }

        try {
            await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${siteUrl}/id/auth/callback?next=/id/dashboard`,
                },
            });
        } catch (error) {
            console.error(`[Bundle Webhook] Failed to send OTP for ${app}:`, error);
            await notifyAuthEmailFailure({
                appLabel: app === 'clientdesk' ? 'Client Desk' : 'Fastpik',
                emailFlow: 'OTP',
                email,
                name,
                transactionId,
                error,
            });
        }
    } else {
        userId = createdUser.user.id;

        if (app === 'clientdesk') {
            const { error } = await supabase.from('profiles').upsert(
                {
                    id: userId,
                    full_name: name,
                },
                { onConflict: 'id' }
            );
            if (error) {
                console.error('[Bundle Webhook] Failed to upsert Client Desk profile:', error);
            }
        }

        try {
            await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${siteUrl}/id/auth/callback?type=recovery`,
            });
        } catch (error) {
            console.error(`[Bundle Webhook] Failed to send password reset for ${app}:`, error);
            await notifyAuthEmailFailure({
                appLabel: app === 'clientdesk' ? 'Client Desk' : 'Fastpik',
                emailFlow: 'Password Reset',
                email,
                name,
                transactionId,
                error,
            });
        }
    }

    return userId;
}

async function upsertBundleSubscription(params: {
    app: BundleApp;
    supabase: any;
    userId: string;
    tier: ClientDeskPlanTier;
    transactionId: string;
    startDate: string;
    endDate: string | null;
    amount: number;
    email: string;
    name: string;
    productName: string;
}) {
    const { app, supabase, userId, tier, transactionId, startDate, endDate, amount, email, name, productName } = params;

    if (await hasTransactionInSubscriptionHistory(supabase, transactionId)) {
        return false;
    }

    const existing = await getSubscriptionByUserId(supabase, userId);
    if (existing?.mayar_transaction_id === transactionId) {
        return false;
    }
    const eventType = resolveSubscriptionHistoryEvent(existing, tier);

    const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
            user_id: userId,
            tier,
            status: 'active',
            start_date: startDate,
            end_date: endDate,
            mayar_transaction_id: transactionId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select('id')
        .single();

    if (error) {
        throw new Error(`[Bundle Webhook] ${app} subscription upsert failed: ${error.message}`);
    }

    await insertSubscriptionHistory({
        supabase,
        userId,
        subscriptionId: data?.id || existing?.id || null,
        eventType,
        tier,
        periodStart: startDate,
        periodEnd: endDate,
        amount,
        transactionId,
        metadata: {
            source: app === 'clientdesk' ? 'bundle_webhook' : 'bundle_webhook_fastpik',
            app,
            productName,
            customerEmail: email,
            customerName: name,
        },
    });

    return true;
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
    const productName = orderData.productName || orderData.product_name || payload.data?.productName || payload.data?.product_name || 'unknown';

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

    const amountNum = parseAmountNumber(amount);
    const planTier = detectFastpikPlanFromAmount(amountNum);

    if (!planTier) {
        console.log(`[Fastpik Webhook] Unknown amount: ${amountNum}`);
        await notifyAlert(
            `<b>⚠️ Fastpik: Unknown Amount</b>\n\n` +
            `📦 Product: ${tg(productName)}\n` +
            `👤 ${tg(name)}\n` +
            `📧 ${tg(email)}\n` +
            `💰 Rp ${formatAmountIdr(amount)}\n` +
            `📝 Expected: 15k / 39k / 109.650 / 149k / 349k (±${FASTPIK_AMOUNT_TOLERANCE.toLocaleString('id-ID')})\n` +
            `🧾 Order: ${tg(transactionId)}`
        );
        return jsonResponse('Success', `Unknown amount: ${amountNum}`);
    }

    const isLifetime = planTier === 'lifetime';
    const planDurationDays = isLifetime ? 0 : getClientDeskPlanDurationDays(planTier);

    const [alreadyInHistory, alreadyInSubscriptions] = await Promise.all([
        hasTransactionInSubscriptionHistory(fastpikSupabase, transactionId),
        hasTransactionInSubscriptions(fastpikSupabase, transactionId),
    ]);

    if (alreadyInHistory || alreadyInSubscriptions) {
        console.log(`[Fastpik Webhook] Duplicate transaction ignored: ${transactionId}`);
        return jsonResponse('Success', `Duplicate transaction ignored: ${transactionId}`);
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
        const existingUserId = await findUserIdByEmail(fastpikSupabase, email);
        if (existingUserId) {
            userId = existingUserId;
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
                await notifyAuthEmailFailure({
                    appLabel: 'Fastpik',
                    emailFlow: 'OTP',
                    email,
                    name,
                    transactionId,
                    error: e,
                });
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
            await notifyAuthEmailFailure({
                appLabel: 'Fastpik',
                emailFlow: 'Password Reset',
                email,
                name,
                transactionId,
                error: e,
            });
        }
    }

    if (!userId) {
        return jsonResponse('Error', 'User ID error', 500);
    }

    // Calculate dates
    const startDate = new Date();
    let endDate: string | null = null;
    if (!isLifetime) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + planDurationDays);
        endDate = end.toISOString();
    }

    const existingSubscription = await getSubscriptionByUserId(fastpikSupabase, userId);
    const historyEventType = resolveSubscriptionHistoryEvent(existingSubscription, planTier);

    // Upsert subscription
    const { data: subscriptionRow, error: upsertError } = await fastpikSupabase
        .from('subscriptions')
        .upsert({
            user_id: userId,
            tier: planTier,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate,
            mayar_transaction_id: transactionId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select('id')
        .single();

    if (upsertError) {
        console.error('[Fastpik Webhook] Subscription upsert error:', upsertError);
        throw upsertError;
    }

    await insertSubscriptionHistory({
        supabase: fastpikSupabase,
        userId,
        subscriptionId: subscriptionRow?.id || existingSubscription?.id || null,
        eventType: historyEventType,
        tier: planTier,
        periodStart: startDate.toISOString(),
        periodEnd: endDate,
        amount: amountNum,
        transactionId,
        metadata: {
            source: 'fastpik_webhook',
            productName,
            customerEmail: email,
            customerName: name,
        },
    });

    // Telegram notification
    await notifyPurchase(
        `<b>Fastpik Purchase!</b>\n\n` +
        `📦 ${tg(planTier)}\n` +
        `👤 ${tg(name)}\n` +
        `📧 ${tg(email)}\n` +
        `💰 Rp ${formatAmountIdr(amountNum)}\n` +
        `🔑 Transaction: ${tg(transactionId)}`
    );

    console.log(`[Fastpik Webhook] ✅ Subscription activated: ${email} -> ${planTier}`);
    return jsonResponse('Success', `Fastpik subscription activated: ${planTier}`);
}

// =============================================
// CLIENT DESK SUBSCRIPTION HANDLER
// =============================================

async function handleClientDeskSubscription(
    orderData: MayarOrderData,
    payload: MayarWebhookPayload
): Promise<NextResponse> {
    const clientdeskSupabase = getClientDeskSupabase();
    const CLIENTDESK_SITE_URL = process.env.CLIENTDESK_SITE_URL || 'https://clientdesk.ryanekoapp.web.id';

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

    console.log(`[Client Desk Webhook] Email: ${email}, Name: ${name}, Status: ${rawStatus}, Amount: ${amount}`);

    if (!email) {
        console.error('[Client Desk Webhook] No email found in payload');
        return jsonResponse('Error', 'No email provided', 400);
    }

    // Check payment status
    const statusStr = rawStatus?.toString().toLowerCase();
    const isSuccess = rawStatus === true ||
        ['success', 'settlement', 'paid', 'successful'].includes(statusStr);

    if (!isSuccess) {
        return jsonResponse('Success', `Ignored status: ${rawStatus}`);
    }

    // Determine plan from amount only (same approach as Fastpik) with Client Desk discount/tolerance rules
    const amountNum = parseAmountNumber(amount);
    const productName = orderData.productName || orderData.product_name || payload.data?.productName || payload.data?.product_name || 'unknown';
    const planTier = detectClientDeskPlanFromAmount(amountNum);

    if (!planTier) {
        console.log(`[Client Desk Webhook] Plan not detected from amount: ${amountNum}`);
        await notifyAlert(
            `<b>⚠️ Client Desk: Unknown Amount</b>\n\n` +
            `📦 Product: ${tg(productName)}\n` +
            `👤 ${tg(name)}\n` +
            `📧 ${tg(email)}\n` +
            `💰 Rp ${formatAmountIdr(amount)}\n` +
            `🔎 Detection: amount-only\n` +
            `📝 Rule: min 50% of base price, max base + tolerance\n` +
            `🧾 Order: ${tg(transactionId)}`
        );
        return jsonResponse('Success', `Unknown amount: ${amountNum}`);
    }

    const priceValidation = validateClientDeskAmountForTier(planTier, amountNum);
    if (!priceValidation.isValid) {
        console.log(`[Client Desk Webhook] Amount outside allowed range for ${planTier}: ${amountNum}`);
        await notifyAlert(
            `<b>⚠️ Client Desk: Unknown Amount</b>\n\n` +
            `📦 Product: ${tg(productName)}\n` +
            `👤 ${tg(name)}\n` +
            `📧 ${tg(email)}\n` +
            `💰 Amount: Rp ${formatAmountIdr(amount)}\n` +
            `🔎 Plan from amount: ${tg(planTier)}\n` +
            `💵 Base: Rp ${priceValidation.basePrice.toLocaleString('id-ID')}\n` +
            `📉 Min (50%): Rp ${priceValidation.minAllowed.toLocaleString('id-ID')}\n` +
            `📈 Max: Rp ${priceValidation.maxAllowed.toLocaleString('id-ID')}\n` +
            `🧾 Order: ${tg(transactionId)}`
        );
        return jsonResponse('Success', `Unknown amount: ${amountNum}`);
    }

    if (await hasTransactionInSubscriptionHistory(clientdeskSupabase, transactionId)) {
        console.log(`[Client Desk Webhook] Duplicate transaction ignored: ${transactionId}`);
        return jsonResponse('Success', `Duplicate transaction ignored: ${transactionId}`);
    }

    const isLifetime = planTier === 'lifetime';
    const planDurationDays = isLifetime ? 0 : getClientDeskPlanDurationDays(planTier);

    // Find or Create User in Client Desk Supabase
    let userId: string | undefined;
    const { data: newUser, error: createError } = await clientdeskSupabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { full_name: name }
    });

    if (createError) {
        // User already exists — find them
        const existingUserId = await findUserIdByEmail(clientdeskSupabase, email);
        if (existingUserId) {
            userId = existingUserId;
            // Send magic link for existing user
            try {
                await clientdeskSupabase.auth.signInWithOtp({
                    email: email,
                    options: {
                        emailRedirectTo: `${CLIENTDESK_SITE_URL}/id/auth/callback?next=/id/dashboard`
                    }
                });
            } catch (e) {
                console.error('[Client Desk Webhook] Failed to send OTP:', e);
                await notifyAuthEmailFailure({
                    appLabel: 'Client Desk',
                    emailFlow: 'OTP',
                    email,
                    name,
                    transactionId,
                    error: e,
                });
            }
        }
    } else {
        userId = newUser.user.id;
        // Create profile for new user
        await clientdeskSupabase.from('profiles').insert({
            id: userId,
            full_name: name,
        });
        // Send password reset for new user
        try {
            await clientdeskSupabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${CLIENTDESK_SITE_URL}/id/auth/callback?type=recovery`
            });
        } catch (e) {
            console.error('[Client Desk Webhook] Failed to send password reset:', e);
            await notifyAuthEmailFailure({
                appLabel: 'Client Desk',
                emailFlow: 'Password Reset',
                email,
                name,
                transactionId,
                error: e,
            });
        }
    }

    if (!userId) {
        return jsonResponse('Error', 'User ID error', 500);
    }

    const existingSubscription = await getSubscriptionByUserId(clientdeskSupabase, userId);
    const historyEventType = resolveSubscriptionHistoryEvent(existingSubscription, planTier);

    // Calculate dates
    const startDate = new Date();
    let endDate = null;
    if (!isLifetime) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + planDurationDays);
        endDate = end.toISOString();
    }

    // Upsert subscription
    const { data: subscriptionRow, error: upsertError } = await clientdeskSupabase
        .from('subscriptions')
        .upsert({
            user_id: userId,
            tier: planTier,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate,
            mayar_transaction_id: transactionId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select('id')
        .single();

    if (upsertError) {
        console.error('[Client Desk Webhook] Subscription upsert error:', upsertError);
        throw upsertError;
    }

    await insertSubscriptionHistory({
        supabase: clientdeskSupabase,
        userId,
        subscriptionId: subscriptionRow?.id || existingSubscription?.id || null,
        eventType: historyEventType,
        tier: planTier,
        periodStart: startDate.toISOString(),
        periodEnd: endDate,
        amount: amountNum,
        transactionId,
        metadata: {
            source: 'clientdesk_webhook',
            productName,
            customerEmail: email,
            customerName: name,
        },
    });

    // Telegram notification
    await notifyPurchase(
        `<b>Client Desk Purchase!</b>\n\n` +
        `📦 ${tg(planTier)}\n` +
        `👤 ${tg(name)}\n` +
        `📧 ${tg(email)}\n` +
        `💰 Rp ${formatAmountIdr(amountNum)}\n` +
        `🔑 Transaction: ${tg(transactionId)}`
    );

    console.log(`[Client Desk Webhook] ✅ Subscription activated: ${email} -> ${planTier}`);
    return jsonResponse('Success', `Client Desk subscription activated: ${planTier}`);
}

// =============================================
// BUNDLE SUBSCRIPTION HANDLER (CLIENT DESK + FASTPIK)
// =============================================

async function handleBundleSubscription(
    orderData: MayarOrderData,
    payload: MayarWebhookPayload
): Promise<NextResponse> {
    const clientdeskSupabase = getClientDeskSupabase();
    const fastpikSupabase = getFastpikSupabase();
    const CLIENTDESK_SITE_URL = process.env.CLIENTDESK_SITE_URL || 'https://clientdesk.ryanekoapp.web.id';
    const FASTPIK_SITE_URL = process.env.FASTPIK_SITE_URL || 'https://fastpik.ryanekoapp.web.id';

    const data = payload.data || payload;
    const rawStatus = (data as any).status || (payload as any).status;
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
    const amountNum = parseAmountNumber(amount);
    const transactionId = orderData.id || (data as any).transactionId || (payload as any).id || `TRX-${Date.now()}`;
    const productName = orderData.productName || orderData.product_name || payload.data?.productName || payload.data?.product_name || 'unknown';

    console.log(`[Bundle Webhook] Email: ${email}, Name: ${name}, Status: ${rawStatus}, Amount: ${amount}`);

    if (!email) {
        return jsonResponse('Error', 'No email provided', 400);
    }

    if (!isPaymentSuccess(rawStatus)) {
        return jsonResponse('Success', `Ignored status: ${rawStatus}`);
    }

    const planTier = detectBundleTierFromAmount(amountNum);
    if (!planTier) {
        await notifyAlert(
            `<b>⚠️ Bundle: Unknown Amount</b>\n\n` +
            `📦 Product: ${tg(productName)}\n` +
            `👤 ${tg(name)}\n` +
            `📧 ${tg(email)}\n` +
            `💰 Amount: Rp ${formatAmountIdr(amount)}\n` +
            `📝 Expected: 49k / 129k / 489k / 749k (±${BUNDLE_AMOUNT_TOLERANCE.toLocaleString('id-ID')})\n` +
            `🧾 Order: ${tg(transactionId)}`
        );
        return jsonResponse('Success', `Unknown bundle amount: ${amountNum}`);
    }

    const [alreadyInClientDesk, alreadyInFastpikHistory, alreadyInFastpikSubscription] = await Promise.all([
        hasTransactionInSubscriptionHistory(clientdeskSupabase, transactionId),
        hasTransactionInSubscriptionHistory(fastpikSupabase, transactionId),
        hasTransactionInSubscriptions(fastpikSupabase, transactionId),
    ]);
    const alreadyInFastpik = alreadyInFastpikHistory || alreadyInFastpikSubscription;

    if (alreadyInClientDesk && alreadyInFastpik) {
        console.log(`[Bundle Webhook] Duplicate transaction ignored: ${transactionId}`);
        return jsonResponse('Success', `Duplicate transaction ignored: ${transactionId}`);
    }

    const [clientDeskUserId, fastpikUserId] = await Promise.all([
        ensureBundleUser({
            app: 'clientdesk',
            supabase: clientdeskSupabase,
            email,
            name,
            siteUrl: CLIENTDESK_SITE_URL,
            transactionId,
        }),
        ensureBundleUser({
            app: 'fastpik',
            supabase: fastpikSupabase,
            email,
            name,
            siteUrl: FASTPIK_SITE_URL,
            transactionId,
        }),
    ]);

    if (!clientDeskUserId || !fastpikUserId) {
        return jsonResponse('Error', 'User ID error', 500);
    }

    const { startDate, endDate } = resolveSubscriptionDates(planTier);

    const [updatedClientDesk, updatedFastpik] = await Promise.all([
        upsertBundleSubscription({
            app: 'clientdesk',
            supabase: clientdeskSupabase,
            userId: clientDeskUserId,
            tier: planTier,
            transactionId,
            startDate,
            endDate,
            amount: amountNum,
            email,
            name,
            productName,
        }),
        upsertBundleSubscription({
            app: 'fastpik',
            supabase: fastpikSupabase,
            userId: fastpikUserId,
            tier: planTier,
            transactionId,
            startDate,
            endDate,
            amount: amountNum,
            email,
            name,
            productName,
        }),
    ]);

    if (!updatedClientDesk && !updatedFastpik) {
        console.log(`[Bundle Webhook] Duplicate upsert skipped by transaction: ${transactionId}`);
        return jsonResponse('Success', `Duplicate transaction ignored: ${transactionId}`);
    }

    await notifyPurchase(
        `<b>Bundle Purchase!</b>\n\n` +
        `📦 Client Desk + Fastpik\n` +
        `🎯 Tier: ${tg(planTier)}\n` +
        `👤 ${tg(name)}\n` +
        `📧 ${tg(email)}\n` +
        `💰 Rp ${formatAmountIdr(amountNum)}\n` +
        `🔑 Transaction: ${tg(transactionId)}\n` +
        `✅ Client Desk: ${updatedClientDesk ? 'updated' : 'skip'}\n` +
        `✅ Fastpik: ${updatedFastpik ? 'updated' : 'skip'}`
    );

    console.log(`[Bundle Webhook] ✅ Subscription activated: ${email} -> ${planTier}`);
    return jsonResponse('Success', `Bundle activated: ${planTier}`);
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

// Reserve licenses for a purchase
async function reserveLicenses(
    productId: string,
    count: number,
    customerName: string,
    customerEmail: string,
    orderId: string,
    customerInstagram?: string | null
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
                customer_instagram: customerInstagram || null,
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
                `📦 Product: ${tg(product.name)}\n` +
                `📧 Email: ${tg(email)}\n` +
                `❌ Error: ${tg(result.error)}`
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
    const customFields = orderData.custom_field || (payload.data as any)?.custom_field || [];
    const customerInstagram = extractInstagram(customFields);

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
        orderData.id,
        customerInstagram
    );

    console.log(`Reserved ${reservedLicenses.length}/${totalLicenses} licenses`);

    // Out of stock alert
    if (reservedLicenses.length < totalLicenses) {
        await notifyAlert(
            `<b>⚠️ LICENSE SHORTAGE</b>\n\n` +
            `📦 Product: ${tg(product.name)}\n` +
            `🧾 Order: ${tg(orderData.id)}\n` +
            `📧 Customer: ${tg(customerEmail)}\n` +
            `📊 Needed: ${totalLicenses}\n` +
            `📉 Available: ${reservedLicenses.length}`
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
            customer_instagram: customerInstagram,
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
    const serialList = reservedLicenses.map((l, i) => `  ${i + 1}. <code>${tg(l.serial_key)}</code>`).join('\n');
    await notifyPurchase(
        `<b>New Purchase!</b>\n\n` +
        `📦 ${tg(product.name)}\n` +
        `👤 ${tg(customerName)}\n` +
        `📧 ${tg(customerEmail)}\n` +
        `${customerInstagram ? `📸 @${tg(customerInstagram)}\n` : ''}` +
        `🔑 ${reservedLicenses.length} license(s)\n\n` +
        `<b>Serial Keys:</b>\n${serialList}\n` +
        `${includesPlugin || isBundle ? '\n🔌 + Plugin' : ''}`
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
            custom_field: payload.custom_field,
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
        // ROUTING: Bundle -> Fastpik -> Client Desk -> Software License
        // ========================================

        // 1. Check if this is a Client Desk + Fastpik bundle purchase
        if (isClientDeskFastpikBundle(productName)) {
            console.log(`[Mayar Webhook] ➡️ Routing to Bundle handler for: ${productName}`);
            return await handleBundleSubscription(orderData, payload);
        }

        // 2. Check if this is a Fastpik subscription purchase
        if (isFastpikProduct(productName)) {
            console.log(`[Mayar Webhook] ➡️ Routing to Fastpik handler for: ${productName}`);
            return await handleFastpikSubscription(orderData, payload);
        }

        // 3. Check if this is a Client Desk subscription purchase
        if (isClientDeskProduct(productName)) {
            console.log(`[Mayar Webhook] ➡️ Routing to Client Desk handler for: ${productName}`);
            return await handleClientDeskSubscription(orderData, payload);
        }

        // 4. Check if this is a software license purchase
        const product = await detectProduct(productName);
        if (product) {
            console.log(`[Mayar Webhook] ➡️ Routing to License handler for: ${productName}`);
            return await handleLicensePurchase(orderData, payload, product);
        }

        // 5. Unknown product — log and return success to not block webhook
        console.log(`[Mayar Webhook] ❓ Unknown product: ${productName}`);
        await notifyAlert(
            `<b>⚠️ Unknown Product in Webhook</b>\n\n` +
            `📦 Product: ${tg(productName)}\n` +
            `📧 Email: ${tg(customerEmail)}\n` +
            `🧾 Order: ${tg(orderData.id)}`
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
        supportedProducts: ['raw-file-copy-tool', 'realtime-upload-pro', 'photo-split-express', 'fastpik', 'clientdesk', 'clientdesk-fastpik-bundle'],
    });
}
