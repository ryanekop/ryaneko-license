export type SubscriptionDuration = 'monthly' | 'quarterly' | 'yearly';
export type ClientDeskPlan = 'basic' | 'plus' | 'pro';
export type ClientDeskTier = `${ClientDeskPlan}_${SubscriptionDuration}`;
export type FastpikTier = `pro_${SubscriptionDuration}`;

export type ClientDeskPriceMatch = {
    plan: ClientDeskPlan;
    duration: SubscriptionDuration;
    tier: ClientDeskTier;
    price: number;
};

type FastpikPriceMatch = {
    duration: SubscriptionDuration;
    tier: FastpikTier;
    price: number;
};

export const CLIENT_DESK_AMOUNT_TOLERANCE = 1_000;
export const FASTPIK_AMOUNT_TOLERANCE = 1_000;
export const BUNDLE_AMOUNT_TOLERANCE = 2_000;

export const FASTPIK_PRICE_CATALOG: readonly FastpikPriceMatch[] = [
    { duration: 'monthly', tier: 'pro_monthly', price: 29_000 },
    { duration: 'quarterly', tier: 'pro_quarterly', price: 79_000 },
    { duration: 'yearly', tier: 'pro_yearly', price: 289_000 },
];

export const CLIENT_DESK_PRICE_CATALOG: readonly ClientDeskPriceMatch[] = [
    { plan: 'basic', duration: 'monthly', tier: 'basic_monthly', price: 49_000 },
    { plan: 'basic', duration: 'quarterly', tier: 'basic_quarterly', price: 129_000 },
    { plan: 'basic', duration: 'yearly', tier: 'basic_yearly', price: 489_000 },
    { plan: 'plus', duration: 'monthly', tier: 'plus_monthly', price: 149_000 },
    { plan: 'plus', duration: 'quarterly', tier: 'plus_quarterly', price: 399_000 },
    { plan: 'plus', duration: 'yearly', tier: 'plus_yearly', price: 1_489_000 },
    { plan: 'pro', duration: 'monthly', tier: 'pro_monthly', price: 249_000 },
    { plan: 'pro', duration: 'quarterly', tier: 'pro_quarterly', price: 699_000 },
    { plan: 'pro', duration: 'yearly', tier: 'pro_yearly', price: 2_489_000 },
];

export const BUNDLE_PRICE_CATALOG: readonly ClientDeskPriceMatch[] = [
    { plan: 'basic', duration: 'monthly', tier: 'basic_monthly', price: 69_000 },
    { plan: 'basic', duration: 'quarterly', tier: 'basic_quarterly', price: 189_000 },
    { plan: 'basic', duration: 'yearly', tier: 'basic_yearly', price: 689_000 },
    { plan: 'plus', duration: 'monthly', tier: 'plus_monthly', price: 169_000 },
    { plan: 'plus', duration: 'quarterly', tier: 'plus_quarterly', price: 449_000 },
    { plan: 'plus', duration: 'yearly', tier: 'plus_yearly', price: 1_689_000 },
    { plan: 'pro', duration: 'monthly', tier: 'pro_monthly', price: 269_000 },
    { plan: 'pro', duration: 'quarterly', tier: 'pro_quarterly', price: 749_000 },
    { plan: 'pro', duration: 'yearly', tier: 'pro_yearly', price: 2_689_000 },
];

function findNearestMatch<T extends { price: number }>(
    amount: number,
    catalog: readonly T[],
    tolerance: number
): T | null {
    if (!Number.isFinite(amount)) return null;

    const candidates = catalog
        .map((entry) => ({ entry, distance: Math.abs(amount - entry.price) }))
        .filter(({ distance }) => distance <= tolerance)
        .sort((a, b) => a.distance - b.distance);

    return candidates[0]?.entry || null;
}

function isRetiredLifetimeProduct(productName: string): boolean {
    return productName.toLowerCase().includes('lifetime');
}

export function detectFastpikPlanFromAmount(amount: number, productName = ''): FastpikTier | null {
    if (isRetiredLifetimeProduct(productName)) return null;
    return findNearestMatch(amount, FASTPIK_PRICE_CATALOG, FASTPIK_AMOUNT_TOLERANCE)?.tier || null;
}

export function detectClientDeskPlanFromAmount(amount: number, productName = ''): ClientDeskPriceMatch | null {
    if (isRetiredLifetimeProduct(productName)) return null;
    return findNearestMatch(amount, CLIENT_DESK_PRICE_CATALOG, CLIENT_DESK_AMOUNT_TOLERANCE);
}

export function detectBundlePlanFromAmount(amount: number, productName = ''): ClientDeskPriceMatch | null {
    if (isRetiredLifetimeProduct(productName)) return null;
    return findNearestMatch(amount, BUNDLE_PRICE_CATALOG, BUNDLE_AMOUNT_TOLERANCE);
}

export function getDurationDays(duration: SubscriptionDuration): number {
    if (duration === 'monthly') return 30;
    if (duration === 'quarterly') return 90;
    return 365;
}

export function getDurationFromTier(tier: ClientDeskTier | FastpikTier): SubscriptionDuration {
    if (tier.endsWith('_monthly')) return 'monthly';
    if (tier.endsWith('_quarterly')) return 'quarterly';
    return 'yearly';
}

export function mapDurationToFastpikTier(duration: SubscriptionDuration): FastpikTier {
    return `pro_${duration}`;
}
