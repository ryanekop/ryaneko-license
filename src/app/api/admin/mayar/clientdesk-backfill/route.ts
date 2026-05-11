import { NextRequest, NextResponse } from 'next/server';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';

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

type BackfillResult = {
    transactionId: string;
    email: string;
    productName: string;
    action: 'inserted' | 'skipped' | 'error';
    reason?: string;
};

const CLIENT_DESK_PLAN_PRICES: Record<ClientDeskPlanTier, number> = {
    pro_monthly: 39000,
    pro_quarterly: 105000,
    pro_yearly: 389000,
    lifetime: 549000,
};

const CLIENT_DESK_MIN_PRICE_RATIO = 0.5;
const CLIENT_DESK_AMOUNT_TOLERANCE = 1000;

const BUNDLE_PLAN_PRICES: Record<ClientDeskPlanTier, number> = {
    pro_monthly: 49000,
    pro_quarterly: 129000,
    pro_yearly: 489000,
    lifetime: 749000,
};

const BUNDLE_AMOUNT_TOLERANCE = 2000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return NextResponse.json(body, { status });
}

function isAuthorized(request: NextRequest) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return false;

    const headerPassword = request.headers.get('x-admin-password');
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7)
        : '';

    return headerPassword === adminPassword || bearer === adminPassword;
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
            normalized = decimalSeparator === ',' ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
        } else if (commaCount > 0) {
            normalized = isThousandsGrouped(',') ? unsigned.replace(/,/g, '') : unsigned.replace(/,/g, '.');
        } else if (dotCount > 0) {
            normalized = isThousandsGrouped('.') ? unsigned.replace(/\./g, '') : unsigned;
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return NaN;
        return Math.round(isNegative ? -parsed : parsed);
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function isClientDeskProduct(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    return ['client desk', 'clientdesk', 'client-desk'].some((keyword) => lowerName.includes(keyword));
}

function isFastpikProduct(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    return ['fastpik', 'fast pik', 'fast-pik'].some((keyword) => lowerName.includes(keyword));
}

function isBundleProduct(productName: string): boolean {
    const lowerName = productName.toLowerCase();
    return lowerName.includes('bundle') || lowerName.includes('bundling');
}

function validateClientDeskAmountForTier(tier: ClientDeskPlanTier, amount: number) {
    const basePrice = CLIENT_DESK_PLAN_PRICES[tier];
    const minAllowed = Math.floor(basePrice * CLIENT_DESK_MIN_PRICE_RATIO);
    const maxAllowed = basePrice + CLIENT_DESK_AMOUNT_TOLERANCE;
    return Number.isFinite(amount) && amount >= minAllowed && amount <= maxAllowed;
}

function detectClientDeskPlanFromAmount(amount: number): ClientDeskPlanTier | null {
    const tiers: ClientDeskPlanTier[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
    const candidates = tiers
        .map((tier) => ({
            tier,
            distance: Math.abs(amount - CLIENT_DESK_PLAN_PRICES[tier]),
            isValid: validateClientDeskAmountForTier(tier, amount),
        }))
        .filter((candidate) => candidate.isValid);

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0]?.tier || null;
}

function detectBundleTierFromAmount(amount: number): ClientDeskPlanTier | null {
    const tiers: ClientDeskPlanTier[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
    const candidates = tiers
        .map((tier) => ({
            tier,
            distance: Math.abs(amount - BUNDLE_PLAN_PRICES[tier]),
        }))
        .filter((candidate) => candidate.distance <= BUNDLE_AMOUNT_TOLERANCE);

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0]?.tier || null;
}

function getClientDeskPlanDurationDays(tier: ClientDeskPlanTier): number {
    if (tier === 'pro_monthly') return 30;
    if (tier === 'pro_quarterly') return 90;
    if (tier === 'pro_yearly') return 365;
    return 0;
}

function resolveSubscriptionDates(tier: ClientDeskPlanTier, createdAt?: unknown) {
    const startDate = typeof createdAt === 'string' || typeof createdAt === 'number'
        ? new Date(createdAt)
        : new Date();
    const normalizedStart = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
    let endDate: string | null = null;

    if (tier !== 'lifetime') {
        const end = new Date(normalizedStart);
        end.setDate(end.getDate() + getClientDeskPlanDurationDays(tier));
        endDate = end.toISOString();
    }

    return {
        startDate: normalizedStart.toISOString(),
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

function isPaymentReceived(payload: any) {
    return (payload?.event || '') === 'payment.received';
}

function isPaymentSuccess(data: any) {
    const rawStatus = data?.status || data?.transactionStatus;
    const statusStr = rawStatus?.toString().toLowerCase();
    return rawStatus === true || ['success', 'settlement', 'paid', 'successful'].includes(statusStr || '');
}

function getPayloadFromHistoryRow(row: any) {
    if (typeof row?.payload === 'string') {
        try {
            return JSON.parse(row.payload);
        } catch {
            return null;
        }
    }
    return row?.payload && typeof row.payload === 'object' ? row.payload : null;
}

async function findUserIdByEmail(supabase: any, email: string): Promise<string | null> {
    let page = 1;
    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;

        const users = data?.users || [];
        const found = users.find((user: any) => user.email?.toLowerCase() === email.toLowerCase());
        if (found) return found.id;
        if (users.length < 1000) return null;
        page += 1;
    }
}

async function getSubscriptionByUserId(supabase: any, userId: string) {
    const { data } = await supabase
        .from('subscriptions')
        .select('id, user_id, tier, status, end_date, trial_end_date, mayar_transaction_id')
        .eq('user_id', userId)
        .maybeSingle();
    return data as ExistingSubscription | null;
}

async function hasHistoryTransaction(supabase: any, transactionId: string) {
    const { count, error } = await supabase
        .from('subscription_history')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_id', transactionId);

    if (error) throw error;
    return (count || 0) > 0;
}

async function processClientDeskPayload(payload: any, dryRun: boolean): Promise<BackfillResult> {
    const data = payload?.data || payload;
    const customer = data?.customer || data?.customerDetail || payload?.customer || {};
    const productName = data?.productName || data?.product_name || payload?.productName || payload?.product_name || '';
    const email =
        data?.customerEmail ||
        data?.customer_email ||
        payload?.customerEmail ||
        payload?.customer_email ||
        customer.email ||
        data?.email ||
        payload?.email ||
        '';
    const amount = data?.amount || data?.totalAmount || data?.gross_amount || payload?.amount || 0;
    const amountNum = parseAmountNumber(amount);
    const transactionId = data?.transactionId || data?.id || payload?.transactionId || payload?.id || '';
    const name =
        data?.customerName ||
        data?.customer_name ||
        payload?.customerName ||
        payload?.customer_name ||
        customer.name ||
        customer.fullName ||
        data?.name ||
        payload?.name ||
        'User';

    if (!transactionId || !email || !productName) {
        return { transactionId: transactionId || '-', email: email || '-', productName, action: 'skipped', reason: 'missing required payload fields' };
    }

    if (!isPaymentReceived(payload) || !isPaymentSuccess(data)) {
        return { transactionId, email, productName, action: 'skipped', reason: 'not paid payment.received' };
    }

    const isBundle = isBundleProduct(productName) && isClientDeskProduct(productName) && isFastpikProduct(productName);
    const isClientDesk = isClientDeskProduct(productName);
    if (!isClientDesk && !isBundle) {
        return { transactionId, email, productName, action: 'skipped', reason: 'not Client Desk product' };
    }

    const tier = isBundle ? detectBundleTierFromAmount(amountNum) : detectClientDeskPlanFromAmount(amountNum);
    if (!tier) {
        return { transactionId, email, productName, action: 'skipped', reason: `unknown amount ${amountNum}` };
    }

    const supabase = getClientDeskSupabase();
    if (await hasHistoryTransaction(supabase, transactionId)) {
        return { transactionId, email, productName, action: 'skipped', reason: 'history exists' };
    }

    const userId = await findUserIdByEmail(supabase, email);
    if (!userId) {
        return { transactionId, email, productName, action: 'skipped', reason: 'Client Desk user not found' };
    }

    if (dryRun) {
        return { transactionId, email, productName, action: 'skipped', reason: `dry run would insert ${tier}` };
    }

    const existing = await getSubscriptionByUserId(supabase, userId);
    const eventType = resolveSubscriptionHistoryEvent(existing, tier);
    const { startDate, endDate } = resolveSubscriptionDates(tier, data?.createdAt || data?.updatedAt);

    const { data: subscriptionRow, error: upsertError } = await supabase
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

    if (upsertError) throw upsertError;

    const { error: historyError } = await supabase
        .from('subscription_history')
        .insert({
            user_id: userId,
            subscription_id: subscriptionRow?.id || existing?.id || null,
            event_type: eventType,
            tier,
            status: 'active',
            period_start: startDate,
            period_end: endDate,
            amount: amountNum,
            currency: 'IDR',
            transaction_id: transactionId,
            metadata: {
                source: 'mayar_backfill',
                productName,
                customerEmail: email,
                customerName: name,
            },
        });

    if (historyError) throw historyError;

    return { transactionId, email, productName, action: 'inserted' };
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    const apiKey = process.env.MAYAR_API_KEY;
    if (!apiKey) {
        return jsonResponse({ success: false, message: 'MAYAR_API_KEY is not configured' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);
    const maxPages = Math.min(Math.max(Number(body.maxPages) || 5, 1), 50);
    const pageSize = Math.min(Math.max(Number(body.pageSize) || 25, 1), 100);
    const baseUrl = process.env.MAYAR_API_BASE_URL || 'https://api.mayar.id/hl/v1';
    const results: BackfillResult[] = [];

    try {
        for (let page = 1; page <= maxPages; page += 1) {
            const response = await fetch(`${baseUrl}/webhook/history?page=${page}&pageSize=${pageSize}`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                cache: 'no-store',
            });

            if (!response.ok) {
                const text = await response.text();
                return jsonResponse({ success: false, message: `Mayar API error ${response.status}: ${text}` }, 502);
            }

            const payload = await response.json();
            const rows = Array.isArray(payload?.data) ? payload.data : [];
            if (rows.length === 0) break;

            for (const row of rows) {
                const webhookPayload = getPayloadFromHistoryRow(row);
                if (!webhookPayload) continue;

                try {
                    results.push(await processClientDeskPayload(webhookPayload, dryRun));
                } catch (error) {
                    results.push({
                        transactionId: webhookPayload?.data?.transactionId || webhookPayload?.data?.id || '-',
                        email: webhookPayload?.data?.customerEmail || '-',
                        productName: webhookPayload?.data?.productName || '-',
                        action: 'error',
                        reason: error instanceof Error ? error.message : String(error),
                    });
                }
            }

            if (payload?.hasMore === false || page >= Number(payload?.pageCount || maxPages)) break;
        }

        return jsonResponse({
            success: true,
            dryRun,
            inserted: results.filter((item) => item.action === 'inserted').length,
            skipped: results.filter((item) => item.action === 'skipped').length,
            errors: results.filter((item) => item.action === 'error').length,
            results,
        });
    } catch (error) {
        return jsonResponse({
            success: false,
            message: error instanceof Error ? error.message : String(error),
        }, 500);
    }
}
