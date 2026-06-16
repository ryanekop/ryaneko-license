import {
    BUNDLE_PRICE_CATALOG,
    CLIENT_DESK_PRICE_CATALOG,
    FASTPIK_PRICE_CATALOG,
    getDurationDays,
    getDurationFromTier,
    type ClientDeskPlan,
    type ClientDeskTier,
    type SubscriptionDuration,
} from './mayar-subscription-catalog.ts';

export type ClientDeskPriceSource = 'standalone' | 'bundle';
export type SubscriptionChangeKind = 'purchase' | 'renewal' | 'upgrade' | 'downgrade';

export type SubscriptionValuation = {
    value: number;
    startsAt: string;
    endsAt: string;
    priceSource: ClientDeskPriceSource;
};

export type ImmediateSubscriptionPeriod = {
    kind: Exclude<SubscriptionChangeKind, 'downgrade'>;
    startDate: string;
    endDate: string;
    previousEndDate: string | null;
    remainingCredit: number;
    bonusDurationMs: number;
    purchasePrice: number;
    entitlementValue: number;
    entitlementDurationMs: number;
    priceSource: ClientDeskPriceSource;
};

export type ScheduledSubscriptionPeriod = {
    kind: 'downgrade';
    startDate: string;
    endDate: string;
    purchasePrice: number;
    entitlementValue: number;
    entitlementDurationMs: number;
    priceSource: ClientDeskPriceSource;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_RANK: Record<ClientDeskPlan, number> = {
    basic: 1,
    plus: 2,
    pro: 3,
};

function toTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPlanFromTier(tier: string): ClientDeskPlan | null {
    if (tier.startsWith('basic_')) return 'basic';
    if (tier.startsWith('plus_')) return 'plus';
    if (tier.startsWith('pro_')) return 'pro';
    return null;
}

export function classifyClientDeskChange(
    existingTier: string | null,
    nextTier: ClientDeskTier,
    hasActivePaidSubscription: boolean,
): SubscriptionChangeKind {
    if (!hasActivePaidSubscription || !existingTier) return 'purchase';

    const existingPlan = getPlanFromTier(existingTier);
    const nextPlan = getPlanFromTier(nextTier);
    if (!existingPlan || !nextPlan) return 'purchase';
    if (existingPlan === nextPlan) return 'renewal';
    return PLAN_RANK[nextPlan] > PLAN_RANK[existingPlan] ? 'upgrade' : 'downgrade';
}

export function getClientDeskTierPrice(
    tier: ClientDeskTier,
    source: ClientDeskPriceSource,
): number {
    const catalog = source === 'bundle' ? BUNDLE_PRICE_CATALOG : CLIENT_DESK_PRICE_CATALOG;
    const match = catalog.find((entry) => entry.tier === tier);
    if (!match) throw new Error(`Price not found for Client Desk tier: ${tier}`);

    if (source === 'standalone') return match.price;

    const fastpikTier = `pro_${match.duration}`;
    const fastpikPrice = FASTPIK_PRICE_CATALOG.find((entry) => entry.tier === fastpikTier)?.price;
    if (!fastpikPrice) throw new Error(`Fastpik bundle component price not found for duration: ${match.duration}`);

    return match.price - fastpikPrice;
}

export function getFastpikTierPrice(tier: string): number {
    const match = FASTPIK_PRICE_CATALOG.find((entry) => entry.tier === tier);
    if (!match) throw new Error(`Price not found for Fastpik tier: ${tier}`);
    return match.price;
}

export function getTierDurationMs(tier: ClientDeskTier): number {
    return getDurationDays(getDurationFromTier(tier)) * DAY_MS;
}

export function calculateRemainingCredit(
    valuation: SubscriptionValuation,
    now = new Date(),
): number {
    const startsAt = toTimestamp(valuation.startsAt);
    const endsAt = toTimestamp(valuation.endsAt);
    if (startsAt === null || endsAt === null || endsAt <= startsAt || valuation.value <= 0) return 0;

    const nowMs = now.getTime();
    if (nowMs >= endsAt) return 0;
    if (nowMs <= startsAt) return valuation.value;

    return valuation.value * ((endsAt - nowMs) / (endsAt - startsAt));
}

export function createFallbackValuation(params: {
    tier: ClientDeskTier;
    endDate: string;
    source?: ClientDeskPriceSource;
}): SubscriptionValuation {
    const { tier, endDate, source = 'standalone' } = params;
    const endsAt = new Date(endDate);
    const startsAt = new Date(endsAt.getTime() - getTierDurationMs(tier));

    return {
        value: getClientDeskTierPrice(tier, source),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        priceSource: source,
    };
}

export function calculateImmediateSubscriptionPeriod(params: {
    kind: Exclude<SubscriptionChangeKind, 'downgrade'>;
    nextTier: ClientDeskTier;
    priceSource: ClientDeskPriceSource;
    existingEndDate?: string | null;
    existingValuation?: SubscriptionValuation | null;
    now?: Date;
}): ImmediateSubscriptionPeriod {
    const {
        kind,
        nextTier,
        priceSource,
        existingEndDate = null,
        existingValuation = null,
        now = new Date(),
    } = params;
    const nowMs = now.getTime();
    const durationMs = getTierDurationMs(nextTier);
    const purchasePrice = getClientDeskTierPrice(nextTier, priceSource);
    const existingEndMs = toTimestamp(existingEndDate);
    const activeEndMs = existingEndMs !== null && existingEndMs > nowMs ? existingEndMs : null;
    const remainingCredit = existingValuation
        ? calculateRemainingCredit(existingValuation, now)
        : 0;

    if (kind === 'renewal') {
        const endMs = (activeEndMs || nowMs) + durationMs;
        return {
            kind,
            startDate: now.toISOString(),
            endDate: new Date(endMs).toISOString(),
            previousEndDate: activeEndMs ? new Date(activeEndMs).toISOString() : null,
            remainingCredit,
            bonusDurationMs: 0,
            purchasePrice,
            entitlementValue: remainingCredit + purchasePrice,
            entitlementDurationMs: endMs - nowMs,
            priceSource,
        };
    }

    const nextPricePerMs = purchasePrice / durationMs;
    const bonusDurationMs = kind === 'upgrade' && remainingCredit > 0
        ? Math.round(remainingCredit / nextPricePerMs)
        : 0;
    const endMs = nowMs + durationMs + bonusDurationMs;

    return {
        kind,
        startDate: now.toISOString(),
        endDate: new Date(endMs).toISOString(),
        previousEndDate: activeEndMs ? new Date(activeEndMs).toISOString() : null,
        remainingCredit: kind === 'upgrade' ? remainingCredit : 0,
        bonusDurationMs,
        purchasePrice,
        entitlementValue: purchasePrice + (kind === 'upgrade' ? remainingCredit : 0),
        entitlementDurationMs: endMs - nowMs,
        priceSource,
    };
}

export function calculateScheduledSubscriptionPeriod(params: {
    nextTier: ClientDeskTier;
    priceSource: ClientDeskPriceSource;
    queueAfter: string;
}): ScheduledSubscriptionPeriod {
    const { nextTier, priceSource, queueAfter } = params;
    const startMs = toTimestamp(queueAfter);
    if (startMs === null) throw new Error('Invalid scheduled subscription start date');

    const durationMs = getTierDurationMs(nextTier);
    const purchasePrice = getClientDeskTierPrice(nextTier, priceSource);

    return {
        kind: 'downgrade',
        startDate: new Date(startMs).toISOString(),
        endDate: new Date(startMs + durationMs).toISOString(),
        purchasePrice,
        entitlementValue: purchasePrice,
        entitlementDurationMs: durationMs,
        priceSource,
    };
}

export function getDurationLabel(durationMs: number): string {
    const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    return [
        days > 0 ? `${days} hari` : '',
        hours > 0 ? `${hours} jam` : '',
        minutes > 0 ? `${minutes} menit` : '',
    ].filter(Boolean).join(' ') || '0 menit';
}

export function getDurationFromClientDeskTier(tier: ClientDeskTier): SubscriptionDuration {
    return getDurationFromTier(tier);
}
