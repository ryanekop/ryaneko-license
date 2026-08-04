export const CLIENTDESK_PLANS = ['basic', 'plus', 'pro'] as const;
export const CLIENTDESK_DURATIONS = ['monthly', 'quarterly', 'yearly', 'lifetime'] as const;

export type ClientDeskPlan = (typeof CLIENTDESK_PLANS)[number];
export type ClientDeskDuration = (typeof CLIENTDESK_DURATIONS)[number];
export type ClientDeskPaidTier = `${ClientDeskPlan}_${ClientDeskDuration}`;
export type ClientDeskTier = 'free' | ClientDeskPaidTier;
export type ClientDeskTierInput = ClientDeskTier | 'lifetime';

export const CLIENTDESK_EDITABLE_TIERS: readonly ClientDeskTierInput[] = [
    'free',
    'basic_monthly',
    'basic_quarterly',
    'basic_yearly',
    'basic_lifetime',
    'plus_monthly',
    'plus_quarterly',
    'plus_yearly',
    'plus_lifetime',
    'pro_monthly',
    'pro_quarterly',
    'pro_yearly',
    'pro_lifetime',
    'lifetime',
];

const PLAN_SET = new Set<string>(CLIENTDESK_PLANS);
const DURATION_SET = new Set<string>(CLIENTDESK_DURATIONS);
const TIER_SET = new Set<string>(CLIENTDESK_EDITABLE_TIERS);

export type ClientDeskSubscriptionLike = {
    tier?: string | null;
    plan?: string | null;
    duration?: string | null;
};

export type ClientDeskTierPeriod = {
    startDate: string;
    endDate: string | null;
    trialEndDate: string | null;
};

function isClientDeskPlan(value: unknown): value is ClientDeskPlan {
    return typeof value === 'string' && PLAN_SET.has(value);
}

function isClientDeskDuration(value: unknown): value is ClientDeskDuration {
    return typeof value === 'string' && DURATION_SET.has(value);
}

export function parseClientDeskTier(value: unknown): ClientDeskTier | null {
    if (value === 'lifetime') return 'basic_lifetime';
    return typeof value === 'string' && TIER_SET.has(value) && value !== 'lifetime'
        ? value as ClientDeskTier
        : null;
}

export function resolveClientDeskPlan(
    subscription: ClientDeskSubscriptionLike,
): ClientDeskPlan | null {
    if (isClientDeskPlan(subscription.plan)) return subscription.plan;

    const canonicalTier = parseClientDeskTier(subscription.tier);
    if (!canonicalTier || canonicalTier === 'free') return null;
    const plan = canonicalTier.split('_', 1)[0];
    return isClientDeskPlan(plan) ? plan : null;
}

export function resolveClientDeskDuration(
    subscription: ClientDeskSubscriptionLike,
): ClientDeskDuration | null {
    if (isClientDeskDuration(subscription.duration)) return subscription.duration;

    const canonicalTier = parseClientDeskTier(subscription.tier);
    if (!canonicalTier || canonicalTier === 'free') return null;
    const duration = canonicalTier.slice(canonicalTier.indexOf('_') + 1);
    return isClientDeskDuration(duration) ? duration : null;
}

export function normalizeClientDeskTier(
    subscription: ClientDeskSubscriptionLike,
): ClientDeskTier | null {
    const plan = resolveClientDeskPlan(subscription);
    const duration = resolveClientDeskDuration(subscription);
    if (plan && duration) return `${plan}_${duration}`;
    return parseClientDeskTier(subscription.tier);
}

export function isClientDeskLifetimeTier(
    tier: string | null | undefined,
    duration?: string | null,
): boolean {
    return duration === 'lifetime' || tier === 'lifetime' || Boolean(tier?.endsWith('_lifetime'));
}

export function getClientDeskTierMetadata(tier: ClientDeskTier): {
    plan: ClientDeskPlan | null;
    duration: ClientDeskDuration | null;
} {
    if (tier === 'free') return { plan: null, duration: null };

    const plan = resolveClientDeskPlan({ tier });
    const duration = resolveClientDeskDuration({ tier });
    if (!plan || !duration) throw new Error(`Invalid Client Desk tier: ${tier}`);
    return { plan, duration };
}

export function getClientDeskTierPeriod(
    tier: ClientDeskTier,
    now = new Date(),
): ClientDeskTierPeriod {
    const start = new Date(now);
    const expiry = new Date(now);

    if (tier === 'free') {
        expiry.setDate(expiry.getDate() + 7);
        return {
            startDate: start.toISOString(),
            endDate: null,
            trialEndDate: expiry.toISOString(),
        };
    }

    const duration = resolveClientDeskDuration({ tier });
    if (duration === 'lifetime') {
        return {
            startDate: start.toISOString(),
            endDate: null,
            trialEndDate: null,
        };
    }

    if (duration === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
    else if (duration === 'quarterly') expiry.setMonth(expiry.getMonth() + 3);
    else if (duration === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);
    else throw new Error(`Invalid Client Desk tier duration: ${tier}`);

    return {
        startDate: start.toISOString(),
        endDate: expiry.toISOString(),
        trialEndDate: null,
    };
}
