import { createHmac } from 'node:crypto';
import { getMayarConfig, listMayarProductTransactions, type MayarProductTransaction } from './mayar-v2.ts';

export const RAW_MAYAR_PRODUCT_ID = '5ea81c66-4550-4ef0-b83b-09e22b8e3749';
const CACHE_MS = 60 * 60 * 1000;
export type PublicSoftwarePurchase = { id: string; name: string; email: string; amount: number; productName: 'RAW File Copy Tool' };
export type SoftwarePurchaseFeed = { purchases: PublicSoftwarePurchase[]; refreshedAt: string | null; refreshAfter: string };
type Page = { items: MayarProductTransaction[]; hasMore: boolean; cursor: string | null };

export function maskSoftwareBuyer(name: string, email: string) {
    const cleanName = name.trim().replace(/[\u0000-\u001f\u007f]/g, '').split(/\s+/)[0];
    const normalizedEmail = email.trim().toLowerCase();
    const at = normalizedEmail.lastIndexOf('@');
    const local = normalizedEmail.slice(0, at);
    // Custom email domains may identify the buyer or their company: mask them too.
    const domain = normalizedEmail.slice(at + 1);
    const publicDomains = new Set(['gmail.com', 'yahoo.com', 'yahoo.co.id', 'outlook.com', 'hotmail.com', 'icloud.com']);
    return {
        name: `${Array.from(cleanName).slice(0, Math.min(3, Math.max(0, Array.from(cleanName).length - 1))).join('')}***`,
        email: `${local.slice(0, Math.min(3, Math.max(0, local.length - 1)))}***@${publicDomains.has(domain) ? domain : '***'}`,
    };
}

export function createSoftwarePurchaseFeed(options: {
    loadPage: (cursor?: string) => Promise<Page>; secret: () => string; now?: () => number;
}) {
    const now = options.now || Date.now;
    let cached: SoftwarePurchaseFeed = { purchases: [], refreshedAt: null, refreshAfter: new Date(now() + CACHE_MS).toISOString() };
    let nextRefresh = 0;
    let pending: Promise<SoftwarePurchaseFeed> | null = null;

    async function refresh(): Promise<SoftwarePurchaseFeed> {
        try {
            const secret = options.secret();
            if (!secret) throw new Error('Missing feed identifier secret');
            const valid = new Map<string, MayarProductTransaction>();
            const cursors = new Set<string>();
            let cursor: string | undefined;
            // Mayar returns newest first; stop once the latest twenty usable payments are available.
            for (let page = 0; page < 10; page++) {
                const result = await options.loadPage(cursor);
                for (const row of result.items) {
                    if (row.paymentLinkId !== RAW_MAYAR_PRODUCT_ID || !['paid', 'settled'].includes(row.status) ||
                        typeof row.id !== 'string' || !row.id || !Number.isSafeInteger(row.amount) || row.amount <= 0 ||
                        !Number.isFinite(row.createdAt) || row.createdAt <= 0 || row.createdAt > now() ||
                        typeof row.customer?.name !== 'string' || !row.customer.name.trim() ||
                        typeof row.customer?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer.email.trim())) continue;
                    valid.set(row.id, row);
                }
                if (valid.size >= 20 || !result.hasMore) break;
                if (!result.cursor || cursors.has(result.cursor)) throw new Error('Invalid provider pagination');
                cursors.add(result.cursor);
                cursor = result.cursor;
                if (page === 9) throw new Error('Provider pagination exceeded limit');
            }
            const purchases = [...valid.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map(row => ({
                id: createHmac('sha256', secret).update(`raw-purchase-feed:${row.id}`).digest('hex').slice(0, 32),
                ...maskSoftwareBuyer(row.customer!.name!, row.customer!.email!),
                amount: row.amount, productName: 'RAW File Copy Tool' as const,
            }));
            cached = { purchases, refreshedAt: new Date(now()).toISOString(), refreshAfter: new Date(now() + CACHE_MS).toISOString() };
        } catch {
            // Feed availability never blocks checkout; retain only previously masked data.
        }
        nextRefresh = now() + CACHE_MS;
        cached = { ...cached, refreshAfter: new Date(nextRefresh).toISOString() };
        return cached;
    }

    return function getFeed(): Promise<SoftwarePurchaseFeed> {
        if (pending) return pending;
        if (now() < nextRefresh) return Promise.resolve(cached);
        pending = refresh().finally(() => { pending = null; });
        return pending;
    };
}

export const getSoftwarePurchaseFeed = createSoftwarePurchaseFeed({
    loadPage: cursor => listMayarProductTransactions(RAW_MAYAR_PRODUCT_ID, cursor),
    secret: () => process.env.SOFTWARE_STORE_SECRET || getMayarConfig().apiKey,
});
