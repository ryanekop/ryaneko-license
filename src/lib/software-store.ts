import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from './supabase.ts';
import {
    closeMayarPaymentRequest, extractPaymentCheckoutUrl, getMayarConfig, getMayarPaymentRequest, getMayarTransaction,
    listMayarPaymentRequests, mayarFetch, MayarApiError,
    type MayarPaymentRequest, type MayarTransaction,
} from './mayar-v2.ts';
import { getEmailHtml, getEmailSubject } from './email-templates.ts';
import { sendEmail } from './resend.ts';
import { escapeTelegramHtml, notifyAlert, notifyPurchase } from './telegram.ts';

export const SOFTWARE_PACKAGES = [
    { count: 1, price: 109000 }, { count: 2, price: 196000 }, { count: 3, price: 278000 },
] as const;
export const SOFTWARE_OS_OPTIONS = [
    'Mac OS Ventura (13.5+)', 'Mac OS Sonoma (14.6+)', 'Mac OS Sequoia (15.6+)',
    'Mac OS Tahoe (26.0+)', 'Windows 7', 'Windows 8/8.1', 'Windows 10', 'Windows 11',
    'Android', 'Mac OS Monterey (12.4+)', 'Mac OS Golden Gate (27.0+)',
];
export const SOFTWARE_SOURCES = ['Instagram', 'Teman/Kerabat', 'Website', 'Tiktok', 'Google Search', 'Lainnya'];
const PRODUCT_NAME = 'RAW File Copy Tool' as const;
const PRODUCT_SLUG = 'raw-file-copy-tool';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SoftwareStatus = 'pending' | 'verifying' | 'fulfilled' | 'expired' | 'awaiting_stock' | 'payment_error';
export type SoftwareCustomer = { name: string; email: string; mobile: string; instagram: string; os: string; source: string };
export type SoftwareReceipt = {
    id: string; kind: 'checkout' | 'legacy'; productName: typeof PRODUCT_NAME; createdAt: string;
    count: number; amount: number | null; status: SoftwareStatus; os: string | null;
    serials: string[]; downloads: Array<{ label: string; url: string }>; checkoutUrl?: string | null;
    paymentStatusKnown?: boolean;
};
type SoftwareOrder = {
    id: string; product_id: string; access_token_hash: string; email_access_token_hash: string | null;
    access_expires_at: string; customer_name: string; customer_email: string; customer_mobile: string;
    customer_instagram: string; os: string; source: string; license_count: number; amount: number;
    status: SoftwareStatus; expires_at: string; created_at: string; email_status: string; superseded_at: string | null;
};
type PaymentAttempt = {
    id: string; order_id: string; status: 'creating' | 'pending' | 'uncertain' | 'paid' | 'expired' | 'failed';
    payment_id: string | null; transaction_id: string | null; checkout_url: string | null;
    redirect_url_hash: string | null; expires_at: string; created_at: string;
};
type StoreProduct = { id: string; name: string; slug: string; download_urls: Record<string, string> | null };
type LegacyPurchase = {
    id: string; order_id: string; product_id: string; customer_email: string; license_count: number;
    licenses_assigned: string[]; created_at: string; raw_payload: Record<string, unknown> | null;
};

export class SoftwareStoreError extends Error {
    readonly code: string;
    readonly status: number;
    readonly retryAfterSeconds?: number;

    constructor(code: string, status = 400, retryAfterSeconds?: number) {
        super(code);
        this.name = 'SoftwareStoreError';
        this.code = code;
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

export function hashStoreToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export function softwareRedirectMatches(expectedHash: string | null, provided: unknown) {
    return typeof provided === 'string' && !!expectedHash && tokenMatches(expectedHash, provided);
}

export function validStoreToken(token: unknown): token is string {
    return typeof token === 'string' && (/^[A-Za-z0-9_-]{43}$/.test(token) || /^[0-9a-f]{64}$/i.test(token));
}

export function normalizeStoreEmail(value: unknown) {
    if (typeof value !== 'string') throw new SoftwareStoreError('invalid_email');
    const email = value.trim().toLowerCase();
    // Restrict to email addresses, excluding Resend display-name/address-list syntax.
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) {
        throw new SoftwareStoreError('invalid_email');
    }
    return email;
}

export function validateSoftwareCheckout(customerValue: unknown, countValue: unknown) {
    if (!customerValue || typeof customerValue !== 'object' || Array.isArray(customerValue)) {
        throw new SoftwareStoreError('invalid_customer');
    }
    const value = customerValue as Record<string, unknown>;
    const field = (key: string, max: number) => {
        const text = typeof value[key] === 'string' ? (value[key] as string).trim() : '';
        if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new SoftwareStoreError('invalid_customer');
        return text;
    };
    const customer: SoftwareCustomer = {
        name: field('name', 100), email: normalizeStoreEmail(value.email), mobile: field('mobile', 20),
        instagram: field('instagram', 31).replace(/^@/, ''), os: field('os', 100), source: field('source', 50),
    };
    if (!/^\+?[0-9]{8,15}$/.test(customer.mobile) || !/^[A-Za-z0-9._]{1,30}$/.test(customer.instagram) ||
        !SOFTWARE_OS_OPTIONS.includes(customer.os) || !SOFTWARE_SOURCES.includes(customer.source)) {
        throw new SoftwareStoreError('invalid_customer');
    }
    const selection = SOFTWARE_PACKAGES.find(item => item.count === countValue);
    if (!selection) throw new SoftwareStoreError('invalid_package');
    return { customer, count: selection.count, amount: selection.price };
}

export function getSoftwareStoreOrigins() {
    const configured = process.env.SOFTWARE_STORE_ALLOWED_ORIGINS;
    const origins = (configured || 'https://ryanekoapp.web.id').split(',').map(value => value.trim()).filter(Boolean);
    if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:3000', 'http://localhost:3001');
    return new Set(origins);
}

export function getSoftwareStoreCatalog() {
    return {
        enabled: process.env.SOFTWARE_STORE_ENABLED === 'true', packages: SOFTWARE_PACKAGES,
        osOptions: SOFTWARE_OS_OPTIONS, sources: SOFTWARE_SOURCES,
    };
}

function database() {
    const client = getSupabaseAdmin();
    if (!client) throw new SoftwareStoreError('service_unavailable', 503);
    return client;
}

async function rpc<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
    const { data, error } = await database().rpc(name, parameters);
    if (error) {
        if (name === 'begin_software_checkout' && error.message === 'Checkout superseded') throw new SoftwareStoreError('checkout_superseded', 409);
        if (name === 'begin_software_checkout' && error.message === 'Checkout access expired') throw new SoftwareStoreError('invalid_access', 401);
        if (name === 'begin_software_checkout' && error.message === 'Checkout selection changed') throw new SoftwareStoreError('checkout_selection_changed', 409);
        throw new SoftwareStoreError('service_unavailable', 503);
    }
    return data as T;
}

async function product() {
    const { data, error } = await database().from('products').select('id,name,slug,download_urls').eq('slug', PRODUCT_SLUG).single();
    if (error || !data) throw new SoftwareStoreError('service_unavailable', 503);
    return data as StoreProduct;
}

async function loadOrder(id: unknown) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new SoftwareStoreError('invalid_access', 401);
    const { data, error } = await database().from('software_orders').select('*').eq('id', id).maybeSingle();
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
    if (!data) throw new SoftwareStoreError('invalid_access', 401);
    return data as SoftwareOrder;
}

async function attempts(orderId: string) {
    const { data, error } = await database().from('software_payment_attempts').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).order('id', { ascending: false });
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
    return (data || []) as PaymentAttempt[];
}

function webUrl() {
    const url = new URL(process.env.SOFTWARE_STORE_WEB_URL || 'https://ryanekoapp.web.id');
    if (!getSoftwareStoreOrigins().has(url.origin)) throw new SoftwareStoreError('service_unavailable', 503);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) {
        throw new SoftwareStoreError('service_unavailable', 503);
    }
    return url.origin;
}

function receiptUrl(orderId: string, token: string) {
    return `${webUrl()}/after-buy/raw-file-copy-tool#${new URLSearchParams({ orderId, token })}`;
}

export function softwareDownloads(links: Record<string, string> | null, os: string | null) {
    if (!links) return [];
    const preferred = os === null ? 'main' : os?.startsWith('Windows') ? 'Windows' : os === 'Android' ? 'Android' :
        os?.includes('Monterey') ? 'macOS-Monterey' : 'macOS';
    const entries = links[preferred] ? [[preferred, links[preferred]]] : links.main ? [['main', links.main]] : Object.entries(links);
    return entries.flatMap(([label, value]) => {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && !url.username && !url.password ? [{ label: label === 'main' ? PRODUCT_NAME : label, url: url.toString() }] : [];
        } catch { return []; }
    });
}

async function orderReceipt(order: SoftwareOrder, includeDetails = true): Promise<SoftwareReceipt> {
    const payments = await attempts(order.id);
    const payment = payments.find(item => item.status === 'paid') || payments[0];
    const receipt: SoftwareReceipt = {
        id: order.id, kind: 'checkout', productName: PRODUCT_NAME, createdAt: order.created_at,
        count: order.license_count, amount: order.amount, status: order.status, os: order.os,
        serials: [], downloads: [], checkoutUrl: payment?.status === 'pending' ? payment.checkout_url : null,
    };
    if (includeDetails && order.status === 'fulfilled') {
        const { data, error } = await database().from('licenses').select('serial_key').eq('product_id', order.product_id).eq('order_id', payment?.transaction_id || '').eq('customer_email', order.customer_email).order('batch_info');
        if (error) throw new SoftwareStoreError('service_unavailable', 503);
        receipt.serials = (data || []).map(item => String(item.serial_key));
        receipt.downloads = softwareDownloads((await product()).download_urls, order.os);
    }
    return receipt;
}

function tokenMatches(hash: string | null, token: string) {
    return !!hash && /^[0-9a-f]{64}$/.test(hash) && timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashStoreToken(token), 'hex'));
}

export function softwareTransactionMatches(order: { id: string; amount: number; customer_email: string }, attempt: { id: string; transaction_id: string | null }, transaction: MayarTransaction) {
    return transaction.status?.toLowerCase() === 'paid' && transaction.amount === order.amount &&
        transaction.customer?.email?.trim().toLowerCase() === order.customer_email &&
        (!attempt.transaction_id || attempt.transaction_id === transaction.id) &&
        transaction.extraData?.software_order_id === order.id && transaction.extraData?.software_attempt_id === attempt.id;
}

async function updateAttempt(attempt: PaymentAttempt, values: Partial<PaymentAttempt>) {
    const { error } = await database().from('software_payment_attempts').update({ ...values, updated_at: new Date().toISOString() }).eq('id', attempt.id).neq('status', 'paid');
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
}

async function markOrder(orderId: string, status: SoftwareStatus) {
    const { error } = await database().from('software_orders').update({ status }).eq('id', orderId).not('status', 'in', '(fulfilled,awaiting_stock)');
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
}

async function deliverOrder(order: SoftwareOrder) {
    if (order.status !== 'fulfilled' || order.email_status === 'sent') return;
    const token = randomBytes(32).toString('base64url');
    const claimed = await rpc<boolean>('claim_software_email', { p_order_id: order.id, p_email_token_hash: hashStoreToken(token) });
    if (!claimed) return;
    let sent = false;
    try {
        const receipt = await orderReceipt(order);
        const downloadLinks = Object.fromEntries(receipt.downloads.map(item => ['main', item.url]));
        const html = getEmailHtml(PRODUCT_SLUG, {
            customerName: escapeTelegramHtml(order.customer_name), serialKeys: receipt.serials.map(escapeTelegramHtml),
            productName: PRODUCT_NAME, downloadLinks, includesPlugin: false,
        }).replace('</body>', `<p><a href="${escapeTelegramHtml(receiptUrl(order.id, token))}">Lihat hasil pembelian di web</a></p><p><a href="${webUrl()}/purchase-history">Riwayat pembelian melalui email</a></p></body>`);
        sent = (await sendEmail({ to: order.customer_email, subject: getEmailSubject(PRODUCT_SLUG, false), html })).success;
        if (sent) {
            const payment = (await attempts(order.id)).find(item => item.status === 'paid');
            if (payment?.transaction_id) await database().from('purchases').update({ license_email_status: 'sent' }).eq('order_id', payment.transaction_id);
        }
        if (!sent) await notifyAlert(`<b>Email pembelian belum terkirim</b>\nProduk: ${PRODUCT_NAME}\nPesanan: ${order.id}\nHasil pembelian tetap tersedia di web.`);
    } finally {
        const { error } = await database().from('software_orders').update({ email_status: sent ? 'sent' : 'failed' }).eq('id', order.id).eq('email_access_token_hash', hashStoreToken(token));
        if (error) throw new SoftwareStoreError('service_unavailable', 503);
    }
}

async function fulfill(order: SoftwareOrder, attempt: PaymentAttempt, transaction: MayarTransaction) {
    if (!softwareTransactionMatches(order, attempt, transaction)) throw new SoftwareStoreError('payment_verification_failed', 409);
    const paidAttempt = (await attempts(order.id)).find(item => item.status === 'paid' && item.id !== attempt.id);
    if (paidAttempt) {
        const claim = await database().from('software_orders').update({ duplicate_payment_notified_at: new Date().toISOString() })
            .eq('id', order.id).is('duplicate_payment_notified_at', null).select('id').maybeSingle();
        if (claim.error) throw new SoftwareStoreError('service_unavailable', 503);
        if (claim.data) await notifyAlert(`<b>Pembayaran kedua perlu ditinjau</b>\nProduk: ${PRODUCT_NAME}\nPesanan: ${order.id}\nTransaksi: ${escapeTelegramHtml(transaction.id)}\nTidak ada serial tambahan yang dialokasikan.`);
        throw new SoftwareStoreError('duplicate_payment_review', 409);
    }
    const result = await rpc<{ order: SoftwareOrder; newly_fulfilled: boolean }>('fulfill_software_order', {
        p_order_id: order.id, p_attempt_id: attempt.id, p_transaction_id: transaction.id,
        p_amount: transaction.amount, p_email: transaction.customer!.email!.trim().toLowerCase(),
        p_raw_payload: { event: 'payment.received', data: { id: transaction.id, status: 'paid', amount: transaction.amount, extraData: transaction.extraData } },
    });
    if (result.order.status === 'awaiting_stock' && order.status !== 'awaiting_stock') {
        await notifyAlert(`<b>Stok serial kurang</b>\nProduk: ${PRODUCT_NAME}\nPesanan: ${order.id}\nJumlah diperlukan: ${order.license_count}`);
    }
    if (result.newly_fulfilled) await notifyPurchase(`<b>Pembelian web selesai</b>\nProduk: ${PRODUCT_NAME}\nPesanan: ${order.id}\nJumlah lisensi: ${order.license_count}`);
    // Email errors must not roll back fulfillment or deny the receipt.
    try { await deliverOrder(result.order); } catch { /* A later receipt/webhook retries email delivery. */ }
}

async function reconcileAttempt(order: SoftwareOrder, attempt: PaymentAttempt) {
    if (attempt.transaction_id) return attempt;
    let cursor: string | undefined;
    // Unknown provider outcomes stay uncertain if this bounded search cannot find proof.
    for (let page = 0; page < 4; page++) {
        const result = await listMayarPaymentRequests(cursor);
        const payment = result.items.find(item => item.extraData?.software_attempt_id === attempt.id ||
            item.transactions?.some(transaction => transaction.extraData?.software_order_id === order.id && transaction.extraData?.software_attempt_id === attempt.id));
        if (payment) {
            const details = await getMayarPaymentRequest(payment.id);
            const transaction = (details.transactions || payment.transactions || []).find(item => item.extraData?.software_order_id === order.id && item.extraData?.software_attempt_id === attempt.id);
            const transactionId = transaction?.id || details.transactionId;
            const checkoutUrl = extractPaymentCheckoutUrl(details.linkUrl || details.linkPayment || payment.linkUrl || payment.linkPayment || details.link || payment.link, getMayarConfig().environment);
            if (!transactionId) break;
            const redirectSupported = softwareRedirectMatches(attempt.redirect_url_hash, details.redirectUrl) || softwareRedirectMatches(attempt.redirect_url_hash, payment.redirectUrl);
            const recovered: PaymentAttempt = { ...attempt, payment_id: payment.id, transaction_id: transactionId, checkout_url: redirectSupported ? checkoutUrl : null, status: redirectSupported && checkoutUrl ? 'pending' : 'uncertain' };
            await updateAttempt(attempt, recovered);
            return recovered;
        }
        if (!result.hasMore || !result.cursor || result.cursor === cursor) break;
        cursor = result.cursor;
    }
    return attempt;
}

async function refreshOrder(order: SoftwareOrder) {
    if (order.status === 'fulfilled') {
        try { await deliverOrder(order); } catch { /* Receipt remains available. */ }
        return;
    }
    if (!await rpc<boolean>('claim_software_verification', { p_order_id: order.id })) return;
    for (let attempt of await attempts(order.id)) {
        if (attempt.status === 'failed') continue;
        if (!attempt.transaction_id) {
            if (Date.now() - Date.parse(attempt.created_at) < 30_000 && attempt.status === 'creating') continue;
            attempt = await reconcileAttempt(order, attempt);
        }
        if (!attempt.transaction_id) continue;
        const transaction = await getMayarTransaction(attempt.transaction_id);
        if (transaction.status?.toLowerCase() === 'paid') {
            await fulfill(order, attempt, transaction);
            return;
        }
        // Only an authenticated provider response can expire a payment for regeneration.
        if (transaction.id !== attempt.transaction_id || transaction.amount !== order.amount ||
            transaction.customer?.email?.trim().toLowerCase() !== order.customer_email ||
            transaction.extraData?.software_order_id !== order.id || transaction.extraData?.software_attempt_id !== attempt.id) {
            throw new SoftwareStoreError('payment_verification_failed', 409);
        }
        const providerStatus = transaction.status?.toLowerCase();
        if (providerStatus === 'expired' || providerStatus === 'closed') {
            await updateAttempt(attempt, { status: 'expired' });
        } else if (['unpaid', 'active', 'pending', 'created'].includes(providerStatus) &&
            (transaction.expirationDate || Date.parse(attempt.expires_at)) <= Date.now()) {
            if (await closeVerifiedAttempt(order, attempt)) return;
        }
    }
    const remaining = await attempts(order.id);
    if (remaining.every(item => item.status === 'expired' || item.status === 'failed')) await markOrder(order.id, 'expired');
}

async function closeVerifiedAttempt(order: SoftwareOrder, attempt: PaymentAttempt) {
    if (!attempt.payment_id || !attempt.transaction_id) throw new SoftwareStoreError('payment_pending_reconciliation', 409);
    // Closing a link is not payment evidence: read both resources after the provider mutation.
    await closeMayarPaymentRequest(attempt.payment_id);
    const closed = await getMayarPaymentRequest(attempt.payment_id);
    const afterClose = await getMayarTransaction(attempt.transaction_id);
    if (afterClose.status?.toLowerCase() === 'paid') {
        await fulfill(order, attempt, afterClose);
        return true;
    }
    if (closed.id !== attempt.payment_id || closed.status?.toLowerCase() !== 'closed' ||
        afterClose.id !== attempt.transaction_id || afterClose.amount !== order.amount ||
        afterClose.customer?.email?.trim().toLowerCase() !== order.customer_email ||
        afterClose.extraData?.software_order_id !== order.id || afterClose.extraData?.software_attempt_id !== attempt.id ||
        !['unpaid', 'pending', 'active', 'created', 'expired', 'closed'].includes(afterClose.status?.toLowerCase())) {
        throw new SoftwareStoreError('payment_pending_reconciliation', 409);
    }
    await updateAttempt(attempt, { status: 'expired' });
    return false;
}

async function closeSupersededCheckout(previousToken: string) {
    if (!validStoreToken(previousToken)) throw new SoftwareStoreError('invalid_access', 401);
    const { data, error } = await database().from('software_orders').select('*').eq('access_token_hash', hashStoreToken(previousToken)).maybeSingle();
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
    // A browser may edit its draft before it has ever submitted a checkout.
    if (!data) return null;
    let order = data as SoftwareOrder;
    if (Date.parse(order.access_expires_at) <= Date.now()) throw new SoftwareStoreError('invalid_access', 401);
    await refreshOrder(order);
    order = await loadOrder(order.id);
    if (order.status === 'fulfilled' || order.status === 'awaiting_stock') return order;
    // The row update serializes with begin_software_checkout's FOR UPDATE lock.
    // Retiring the old checkout first prevents another browser tab from regenerating it.
    const retired = await database().from('software_orders').update({ superseded_at: new Date().toISOString() })
        .eq('id', order.id).not('status', 'in', '(fulfilled,awaiting_stock)').select('id').maybeSingle();
    if (retired.error) throw new SoftwareStoreError('service_unavailable', 503);
    if (!retired.data) return loadOrder(order.id);
    for (let attempt of await attempts(order.id)) {
        if (attempt.status === 'failed') continue;
        attempt = await reconcileAttempt(order, attempt);
        if (!attempt.transaction_id) throw new SoftwareStoreError('payment_pending_reconciliation', 409);
        const transaction = await getMayarTransaction(attempt.transaction_id);
        if (transaction.status?.toLowerCase() === 'paid') {
            await fulfill(order, attempt, transaction);
            return loadOrder(order.id);
        }
        if (transaction.id !== attempt.transaction_id || transaction.amount !== order.amount ||
            transaction.customer?.email?.trim().toLowerCase() !== order.customer_email ||
            transaction.extraData?.software_order_id !== order.id || transaction.extraData?.software_attempt_id !== attempt.id) {
            throw new SoftwareStoreError('payment_verification_failed', 409);
        }
        if (attempt.status === 'expired') continue;
        if (await closeVerifiedAttempt(order, attempt)) return loadOrder(order.id);
    }
    await markOrder(order.id, 'expired');
    return null;
}

export async function createSoftwareCheckout(customerValue: unknown, countValue: unknown, token: string, supersedesToken?: unknown) {
    if (!getSoftwareStoreCatalog().enabled) throw new SoftwareStoreError('checkout_disabled', 503);
    if (!validStoreToken(token)) throw new SoftwareStoreError('invalid_access', 401);
    const selection = validateSoftwareCheckout(customerValue, countValue);
    if (supersedesToken !== undefined && supersedesToken !== token) {
        if (typeof supersedesToken !== 'string') throw new SoftwareStoreError('invalid_access', 401);
        const previous = await closeSupersededCheckout(supersedesToken);
        if (previous) return { orderId: previous.id, checkoutUrl: null, receiptUrl: receiptUrl(previous.id, supersedesToken), status: previous.status, expiresAt: previous.expires_at };
    }
    const start = () => rpc<{ order: SoftwareOrder; attempt: PaymentAttempt; created: boolean }>('begin_software_checkout', {
        p_token_hash: hashStoreToken(token), p_customer: selection.customer, p_count: selection.count,
        p_amount: selection.amount, p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    let result = await start();
    if (!result.created) {
        try { await refreshOrder(result.order); } catch (error) {
            if (error instanceof SoftwareStoreError && error.code === 'payment_verification_failed') throw error;
            throw new SoftwareStoreError('payment_check_unavailable', 503);
        }
        result.order = await loadOrder(result.order.id);
        if (result.order.status === 'expired') result = await start();
    }
    const url = receiptUrl(result.order.id, token);
    if (result.order.status === 'fulfilled' || result.order.status === 'awaiting_stock') {
        return { orderId: result.order.id, checkoutUrl: null, receiptUrl: url, status: result.order.status, expiresAt: result.order.expires_at };
    }
    if (result.created) {
        const redirectUrl = url;
        await updateAttempt(result.attempt, { redirect_url_hash: hashStoreToken(redirectUrl) });
        let payment: MayarPaymentRequest;
        try {
            payment = await mayarFetch<MayarPaymentRequest>('/payments/create', {
                method: 'POST', body: JSON.stringify({
                    name: `${PRODUCT_NAME} — ${selection.count} device`, amount: selection.amount,
                    email: selection.customer.email, mobile: selection.customer.mobile,
                    description: `${PRODUCT_NAME}; ${selection.count} device; ${selection.customer.name}; @${selection.customer.instagram}; ${selection.customer.os}; ${selection.customer.source}`,
                    expiredAt: result.attempt.expires_at, redirectUrl,
                    extraData: { software_order_id: result.order.id, software_attempt_id: result.attempt.id },
                }),
            });
        } catch (error) {
            // A timeout, 5xx, duplicate/409 or rate-limit response may follow a committed create.
            const definiteRejection = error instanceof MayarApiError && [400, 401, 403, 404, 422].includes(error.statusCode);
            await updateAttempt(result.attempt, { status: definiteRejection ? 'failed' : 'uncertain' });
            await markOrder(result.order.id, definiteRejection ? 'payment_error' : 'verifying');
            throw new SoftwareStoreError(definiteRejection ? 'payment_unavailable' : 'payment_pending_reconciliation', 503);
        }
        const checkoutUrl = extractPaymentCheckoutUrl(payment.link, getMayarConfig().environment);
        const idsValid = typeof payment.id === 'string' && UUID.test(payment.id) && typeof payment.transactionId === 'string' && UUID.test(payment.transactionId);
        await updateAttempt(result.attempt, {
            payment_id: idsValid ? payment.id : null, transaction_id: idsValid ? payment.transactionId! : null,
            checkout_url: payment.redirectUrl === redirectUrl && idsValid ? checkoutUrl : null,
            status: payment.redirectUrl === redirectUrl && idsValid && checkoutUrl ? 'pending' : 'uncertain',
        });
        if (payment.redirectUrl !== redirectUrl || !checkoutUrl || !idsValid) {
            await markOrder(result.order.id, 'payment_error');
            throw new SoftwareStoreError('payment_redirect_unsupported', 503);
        }
    }
    const refreshedOrder = await loadOrder(result.order.id);
    if (refreshedOrder.status === 'fulfilled' || refreshedOrder.status === 'awaiting_stock') {
        return { orderId: refreshedOrder.id, checkoutUrl: null, receiptUrl: url, status: refreshedOrder.status, expiresAt: refreshedOrder.expires_at };
    }
    const current = (await attempts(result.order.id))[0];
    if (!current?.checkout_url || current.status !== 'pending') throw new SoftwareStoreError('payment_pending_reconciliation', 409);
    return { orderId: result.order.id, checkoutUrl: current.checkout_url, receiptUrl: url, status: 'pending', expiresAt: current.expires_at };
}

export async function getSoftwareReceipt(orderId: unknown, token: string, refresh: boolean) {
    if (!validStoreToken(token)) throw new SoftwareStoreError('invalid_access', 401);
    const order = await loadOrder(orderId);
    if (Date.parse(order.access_expires_at) <= Date.now() ||
        (!tokenMatches(order.access_token_hash, token) && !tokenMatches(order.email_access_token_hash, token))) {
        throw new SoftwareStoreError('invalid_access', 401);
    }
    if (refresh) {
        try { await refreshOrder(order); } catch (error) {
            if (error instanceof SoftwareStoreError && error.code === 'payment_verification_failed') throw error;
            throw new SoftwareStoreError('payment_check_unavailable', 503);
        }
    }
    return orderReceipt(await loadOrder(order.id));
}

function storeHmac(value: string) {
    const key = process.env.SOFTWARE_STORE_SECRET;
    if (!key) throw new SoftwareStoreError('service_unavailable', 503);
    return createHmac('sha256', key).update(value).digest('hex');
}

export async function requestSoftwareOtp(emailValue: unknown, ip: string) {
    const email = normalizeStoreEmail(emailValue);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const result = await rpc<{ allowed: boolean; cooldown_seconds: number }>('begin_software_otp', {
        p_email: email, p_ip_hash: storeHmac(`software-otp-ip:${ip}`), p_code_hash: storeHmac(`${email}\0${code}`),
    });
    if (!result.allowed) throw new SoftwareStoreError('rate_limited', 429, result.cooldown_seconds || 60);
    // Send for every valid email, even when no purchases exist, to avoid enumeration.
    const sent = await sendEmail({
        to: email, subject: 'Kode verifikasi riwayat pembelian — Ryan Eko Apps',
        html: `<p>Kode verifikasi riwayat pembelian Anda:</p><p style="font-size:28px;font-weight:bold">${code}</p><p>Berlaku 10 menit dan hanya dapat digunakan sekali. Jangan bagikan kode ini.</p>`,
    });
    if (!sent.success) throw new SoftwareStoreError('otp_delivery_failed', 503);
    return { message: 'Kode verifikasi telah dikirim. Periksa inbox dan spam email Anda.', cooldownSeconds: 60 };
}

export async function verifySoftwareOtp(emailValue: unknown, codeValue: unknown) {
    const email = normalizeStoreEmail(emailValue);
    if (typeof codeValue !== 'string' || !/^\d{6}$/.test(codeValue)) throw new SoftwareStoreError('invalid_otp', 401);
    const token = randomBytes(32).toString('base64url');
    const result = await rpc<{ verified: boolean; expires_at?: string }>('verify_software_otp', {
        p_email: email, p_code_hash: storeHmac(`${email}\0${codeValue}`), p_session_hash: hashStoreToken(token),
    });
    if (!result.verified || !result.expires_at) throw new SoftwareStoreError('invalid_otp', 401);
    return { sessionToken: token, expiresAt: result.expires_at };
}

async function sessionEmail(token: string) {
    if (!validStoreToken(token)) throw new SoftwareStoreError('invalid_session', 401);
    const { data, error } = await database().from('software_history_sessions').select('email,expires_at').eq('token_hash', hashStoreToken(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
    if (!data) throw new SoftwareStoreError('invalid_session', 401);
    return data.email as string;
}

async function legacyReceipt(purchase: LegacyPurchase, includeDetails = true): Promise<SoftwareReceipt> {
    const receipt: SoftwareReceipt = {
        id: purchase.id, kind: 'legacy', productName: PRODUCT_NAME, createdAt: purchase.created_at,
        count: purchase.license_count, amount: null, status: 'fulfilled', os: null, serials: [], downloads: [],
    };
    // Legacy records do not reliably retain a verified payment status or amount.
    const raw = purchase.raw_payload || {};
    const data = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : raw;
    receipt.status = data.status === 'paid' ? 'fulfilled' : 'verifying';
    receipt.paymentStatusKnown = data.status === 'paid';
    if (includeDetails && purchase.licenses_assigned?.length) {
        const { data: licenses, error } = await database().from('licenses').select('serial_key').in('id', purchase.licenses_assigned).eq('product_id', purchase.product_id).eq('order_id', purchase.order_id).ilike('customer_email', escapeIlike(purchase.customer_email));
        if (error) throw new SoftwareStoreError('service_unavailable', 503);
        receipt.serials = (licenses || []).map(item => String(item.serial_key));
        receipt.downloads = softwareDownloads((await product()).download_urls, null);
    }
    return receipt;
}

function escapeIlike(value: string) { return value.replace(/[\\%_]/g, '\\$&'); }

export async function getSoftwareHistory(token: string, pageValue: unknown) {
    const email = await sessionEmail(token);
    const page = pageValue === undefined ? 1 : pageValue;
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 500) throw new SoftwareStoreError('invalid_page');
    return rpc<{ orders: SoftwareReceipt[]; hasMore: boolean; page: number }>('software_purchase_history', { p_email: email, p_page: page });
}

export async function getSoftwareHistoryDetail(token: string, orderId: unknown, purchaseId: unknown) {
    const email = await sessionEmail(token);
    if (orderId !== undefined) {
        const order = await loadOrder(orderId);
        if (order.customer_email !== email || order.product_id !== (await product()).id) throw new SoftwareStoreError('invalid_access', 401);
        try { await refreshOrder(order); } catch { /* History remains readable when Mayar is unavailable. */ }
        return orderReceipt(await loadOrder(order.id));
    }
    if (typeof purchaseId !== 'string' || !UUID.test(purchaseId)) throw new SoftwareStoreError('invalid_access', 401);
    const { data, error } = await database().from('purchases').select('id,order_id,product_id,customer_email,license_count,licenses_assigned,created_at,raw_payload').eq('id', purchaseId).eq('product_id', (await product()).id).ilike('customer_email', escapeIlike(email)).maybeSingle();
    if (error) throw new SoftwareStoreError('service_unavailable', 503);
    if (!data) throw new SoftwareStoreError('invalid_access', 401);
    return legacyReceipt(data as LegacyPurchase);
}

/** Returns true only for this store's transactions; legacy subscription routing stays intact. */
export async function processSoftwareStoreTransaction(transaction: MayarTransaction) {
    const hint = transaction.extraData?.software_order_id;
    const { data, error } = await database().from('software_payment_attempts').select('*').eq('transaction_id', transaction.id).maybeSingle();
    if (error) {
        // Preserve existing webhooks while an operator has not yet installed the additive migration.
        if (hint === undefined && ['42P01', 'PGRST205'].includes(error.code)) return false;
        throw new SoftwareStoreError('service_unavailable', 503);
    }
    let attempt = data as PaymentAttempt | null;
    if (!attempt && typeof hint === 'string' && UUID.test(hint) && typeof transaction.extraData?.software_attempt_id === 'string') {
        const result = await database().from('software_payment_attempts').select('*').eq('id', transaction.extraData.software_attempt_id).eq('order_id', hint).maybeSingle();
        if (result.error) throw new SoftwareStoreError('service_unavailable', 503);
        attempt = result.data as PaymentAttempt | null;
    }
    if (!attempt) {
        // A store-tagged webhook must never fall through to name-based legacy allocation.
        if (hint !== undefined) throw new SoftwareStoreError('payment_verification_failed', 409);
        return false;
    }
    try { await fulfill(await loadOrder(attempt.order_id), attempt, transaction); }
    catch (error) {
        // Allocation remains unchanged; the administrator has been notified for manual payment review.
        if (!(error instanceof SoftwareStoreError && error.code === 'duplicate_payment_review')) throw error;
    }
    return true;
}
