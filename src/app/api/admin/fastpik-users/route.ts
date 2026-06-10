import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { escapeTelegramHtml, notifyAlert, notifyInfo } from '@/lib/telegram';

// Direct connection to Fastpik Supabase (bypasses Vercel Attack Challenge)
const fastpikSupabase = getFastpikSupabase();

type FastpikTenant = {
    id: string;
    name: string;
    domain: string | null;
    is_active: boolean | null;
};

type FastpikSetting = {
    user_id: string;
    vendor_name: string | null;
    tenant_id: string | null;
};

type FastpikSubscription = {
    user_id: string;
    tier: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    trial_end_date: string | null;
};

type FastpikProfile = {
    id: string;
    full_name: string | null;
};

type SubscriptionPatch = {
    trial_end_date?: string | null;
    end_date?: string | null;
    updated_at?: string;
};

type SubscriptionTier = 'free' | 'pro_monthly' | 'pro_quarterly' | 'pro_yearly' | 'lifetime';

const VALID_TIERS: SubscriptionTier[] = ['free', 'pro_monthly', 'pro_quarterly', 'pro_yearly', 'lifetime'];
const ADMIN_TRIAL_DAYS = 5;

function getErrorMessage(error: unknown) {
    if (typeof error === 'object' && error && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }
    return error instanceof Error ? error.message : 'Unknown server error';
}

function getErrorPayload(error: unknown) {
    const maybePostgrestError = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    return {
        success: false,
        message: getErrorMessage(error),
        code: typeof maybePostgrestError.code === 'string' ? maybePostgrestError.code : undefined,
        details: typeof maybePostgrestError.details === 'string' ? maybePostgrestError.details : undefined,
        hint: typeof maybePostgrestError.hint === 'string' ? maybePostgrestError.hint : undefined,
    };
}

function getLatestDate(...dates: Array<string | null | undefined>) {
    const latest = dates.reduce<number>((max, date) => {
        if (!date) return max;
        const time = new Date(date).getTime();
        return Number.isFinite(time) && time > max ? time : max;
    }, 0);

    return latest > 0 ? new Date(latest).toISOString() : null;
}

function parseTier(tier: unknown): SubscriptionTier | null {
    return typeof tier === 'string' && VALID_TIERS.includes(tier as SubscriptionTier)
        ? tier as SubscriptionTier
        : null;
}

function getTierPeriod(tier: SubscriptionTier) {
    const now = new Date();
    const expiry = new Date(now);

    if (tier === 'free') {
        expiry.setDate(expiry.getDate() + ADMIN_TRIAL_DAYS);
        return { startDate: now.toISOString(), endDate: null, trialEndDate: expiry.toISOString() };
    }

    if (tier === 'pro_monthly') expiry.setMonth(expiry.getMonth() + 1);
    else if (tier === 'pro_quarterly') expiry.setMonth(expiry.getMonth() + 3);
    else if (tier === 'pro_yearly') expiry.setFullYear(expiry.getFullYear() + 1);
    else return { startDate: now.toISOString(), endDate: null, trialEndDate: null };

    return { startDate: now.toISOString(), endDate: expiry.toISOString(), trialEndDate: null };
}

function parseDateInput(value: unknown) {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// GET - list users
export async function GET() {
    try {
        // Get all auth users (paginated — Supabase defaults to 50 per page)
        let authUsers: User[] = [];
        let page = 1;
        while (true) {
            const { data: authData, error: authError } = await fastpikSupabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (authError) throw authError;
            const users = authData?.users || [];
            authUsers = authUsers.concat(users);
            if (users.length < 1000) break;
            page++;
        }

        // Get subscriptions, profiles, and tenant assignment data
        const { data: subscriptions } = await fastpikSupabase.from('subscriptions').select('user_id, tier, status, start_date, end_date, trial_end_date');
        const { data: profiles } = await fastpikSupabase.from('profiles').select('id, full_name');
        const { data: settings } = await fastpikSupabase.from('settings').select('user_id, vendor_name, tenant_id');
        const { data: tenants } = await fastpikSupabase.from('tenants').select('id, name, domain, is_active');

        const subMap = new Map((subscriptions || []).map((s) => {
            const subscription = s as FastpikSubscription;
            return [subscription.user_id, subscription] as const;
        }));
        const profileMap = new Map((profiles || []).map((p) => {
            const profile = p as FastpikProfile;
            return [profile.id, profile] as const;
        }));
        const settingsMap = new Map((settings as FastpikSetting[] | null)?.map(s => [s.user_id, s]) || []);
        const tenantMap = new Map((tenants as FastpikTenant[] | null)?.map(t => [t.id, t]) || []);

        const formattedUsers = authUsers.map(user => {
            const subscription = subMap.get(user.id);
            const profile = profileMap.get(user.id);
            const setting = settingsMap.get(user.id);
            const tenant = setting?.tenant_id ? tenantMap.get(setting.tenant_id) : null;
            return {
                id: user.id,
                email: user.email || 'No Email',
                name: profile?.full_name || user.user_metadata?.full_name || 'No Name',
                vendorName: setting?.vendor_name || null,
                tenantId: setting?.tenant_id || null,
                tenantName: tenant?.name || null,
                tenantDomain: tenant?.domain || null,
                createdAt: user.created_at,
                registeredSortAt: getLatestDate(user.email_confirmed_at, subscription?.start_date, user.created_at) || user.created_at,
                tier: subscription?.tier || 'none',
                status: subscription?.status || 'inactive',
                expiresAt: subscription?.end_date || subscription?.trial_end_date || null,
                lastSignIn: user.last_sign_in_at || null,
                emailConfirmed: !!user.email_confirmed_at,
            };
        });

        formattedUsers.sort((a, b) => new Date(b.registeredSortAt).getTime() - new Date(a.registeredSortAt).getTime());

        return NextResponse.json({ success: true, users: formattedUsers });
    } catch (error: unknown) {
        console.error('Fastpik users GET error:', error);
        return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
    }
}

// POST - create trial user
export async function POST(request: NextRequest) {
    try {
        const { name, email, trialDays = ADMIN_TRIAL_DAYS } = await request.json();
        const safeName = escapeTelegramHtml(name);
        const safeEmail = escapeTelegramHtml(email);

        if (!name || !email) {
            return NextResponse.json({ success: false, message: 'Name and email are required' }, { status: 400 });
        }

        const parsedTrialDays = Number.parseInt(String(trialDays), 10);
        const normalizedTrialDays = Number.isFinite(parsedTrialDays) && parsedTrialDays > 0 ? parsedTrialDays : ADMIN_TRIAL_DAYS;

        // Invite user by email
        const { data: authData, error: authError } = await fastpikSupabase.auth.admin.inviteUserByEmail(email, {
            data: { full_name: name },
            redirectTo: 'https://fastpik.ryanekoapp.web.id/id/auth/callback?next=/id/dashboard',
        });

        if (authError) {
            await notifyAlert(
                `<b>⚠️ Fastpik Invite Failed</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `❌ ${escapeTelegramHtml(authError.message)}`
            );
            return NextResponse.json({ success: false, message: authError.message }, { status: 400 });
        }

        if (!authData.user) {
            await notifyAlert(
                `<b>⚠️ Fastpik Invite Failed</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `❌ Missing user payload from Supabase`
            );
            return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 });
        }

        // Create profile
        const { error: profileError } = await fastpikSupabase.from('profiles').insert({
            id: authData.user.id,
            email,
            full_name: name,
        });
        if (profileError) {
            await notifyAlert(
                `<b>⚠️ Fastpik Invite Partial Failure</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `🆔 ${escapeTelegramHtml(authData.user.id)}\n` +
                `❌ Profile insert: ${escapeTelegramHtml(profileError.message)}`
            );
            return NextResponse.json({ success: false, message: profileError.message }, { status: 500 });
        }

        // Create trial subscription
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + normalizedTrialDays);

        const { error: subscriptionError } = await fastpikSupabase.from('subscriptions').insert({
            user_id: authData.user.id,
            tier: 'free',
            status: 'trial',
            start_date: new Date().toISOString(),
            trial_end_date: trialEndDate.toISOString(),
        });
        if (subscriptionError) {
            await notifyAlert(
                `<b>⚠️ Fastpik Invite Partial Failure</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `🆔 ${escapeTelegramHtml(authData.user.id)}\n` +
                `❌ Subscription insert: ${escapeTelegramHtml(subscriptionError.message)}`
            );
            return NextResponse.json({ success: false, message: subscriptionError.message }, { status: 500 });
        }

        await notifyInfo(
            `<b>Fastpik Invite Sent</b>\n\n` +
            `👤 ${safeName}\n` +
            `📧 ${safeEmail}\n` +
            `🗓️ Trial: ${normalizedTrialDays} hari\n` +
            `🆔 ${escapeTelegramHtml(authData.user.id)}`
        );

        return NextResponse.json({
            success: true,
            message: 'Invitation sent! User will receive email to set their password.',
            user: { id: authData.user.id, email: authData.user.email, name },
        });
    } catch (error: unknown) {
        console.error('Fastpik users POST error:', error);
        const message = getErrorMessage(error);
        await notifyAlert(
            `<b>⚠️ Fastpik Invite Error</b>\n\n` +
            `❌ ${escapeTelegramHtml(message)}`
        );
        return NextResponse.json({ success: false, message }, { status: 500 });
    }
}

// DELETE - delete user
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
        }

        const { error } = await fastpikSupabase.auth.admin.deleteUser(userId);
        if (error) throw error;

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error: unknown) {
        console.error('Fastpik users DELETE error:', error);
        return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
    }
}

// PATCH - edit user (set_expiry, change_tier)
export async function PATCH(request: NextRequest) {
    try {
        const { userId, action, tier, expiryDate, tenantId } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
        }

        if (action === 'assign_tenant') {
            if (!tenantId) {
                return NextResponse.json({ success: false, message: 'Tenant ID is required' }, { status: 400 });
            }

            const { data: userData, error: userError } = await fastpikSupabase.auth.admin.getUserById(userId);
            if (userError || !userData?.user) {
                return NextResponse.json(
                    { success: false, message: userError?.message || 'Fastpik user not found' },
                    { status: 404 },
                );
            }

            const { data: setting, error: settingError } = await fastpikSupabase
                .from('settings')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (settingError) {
                throw settingError;
            }

            if (!setting) {
                return NextResponse.json(
                    { success: false, message: 'Fastpik settings row not found for this user' },
                    { status: 404 },
                );
            }

            const { data: tenant, error: tenantError } = await fastpikSupabase
                .from('tenants')
                .select('id, name, domain, is_active')
                .eq('id', tenantId)
                .maybeSingle();

            if (tenantError) {
                throw tenantError;
            }

            const activeTenant = tenant as FastpikTenant | null;
            if (!activeTenant || activeTenant.is_active !== true) {
                return NextResponse.json(
                    { success: false, message: 'Active Fastpik tenant not found' },
                    { status: 400 },
                );
            }

            const { error: updateError } = await fastpikSupabase
                .from('settings')
                .update({
                    tenant_id: activeTenant.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            if (updateError) throw updateError;

            return NextResponse.json({
                success: true,
                message: 'Fastpik tenant assignment updated',
                tenant: {
                    id: activeTenant.id,
                    name: activeTenant.name,
                    domain: activeTenant.domain,
                },
            });
        }

        if (action === 'set_expiry') {
            const { data: userData, error: userError } = await fastpikSupabase.auth.admin.getUserById(userId);
            if (userError || !userData?.user) {
                return NextResponse.json(
                    { success: false, message: userError?.message || 'Fastpik user not found' },
                    { status: 404 },
                );
            }

            const parsedExpiryDate = parseDateInput(expiryDate);
            if (!parsedExpiryDate) {
                return NextResponse.json({ success: false, message: 'Valid expiry date is required' }, { status: 400 });
            }

            const { data: currentSub, error: currentSubError } = await fastpikSupabase
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', userId)
                .maybeSingle();

            if (currentSubError) throw currentSubError;

            const updateData: SubscriptionPatch = {};
            if (!currentSub || currentSub.status === 'trial' || currentSub.tier === 'free') {
                updateData.trial_end_date = parsedExpiryDate;
                updateData.end_date = null;
            } else {
                updateData.end_date = parsedExpiryDate;
            }
            updateData.updated_at = new Date().toISOString();

            const { error } = currentSub
                ? await fastpikSupabase.from('subscriptions').update(updateData).eq('user_id', userId)
                : await fastpikSupabase.from('subscriptions').insert({
                    user_id: userId,
                    tier: 'free',
                    status: 'trial',
                    start_date: new Date().toISOString(),
                    ...updateData,
                });
            if (error) throw error;

            return NextResponse.json({ success: true, message: 'Expiry date updated' });

        } else if (action === 'change_tier') {
            const { data: userData, error: userError } = await fastpikSupabase.auth.admin.getUserById(userId);
            if (userError || !userData?.user) {
                return NextResponse.json(
                    { success: false, message: userError?.message || 'Fastpik user not found' },
                    { status: 404 },
                );
            }

            const nextTier = parseTier(tier);
            if (!nextTier) {
                return NextResponse.json({ success: false, message: 'Invalid tier' }, { status: 400 });
            }

            const period = getTierPeriod(nextTier);
            const { error } = await fastpikSupabase.from('subscriptions').upsert({
                user_id: userId,
                tier: nextTier,
                status: nextTier === 'free' ? 'trial' : 'active',
                start_date: period.startDate,
                end_date: period.endDate,
                trial_end_date: period.trialEndDate,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

            if (error) throw error;

            return NextResponse.json({ success: true, message: `Tier changed to ${nextTier}` });
        }

        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        console.error('Fastpik users PATCH error:', error);
        return NextResponse.json(getErrorPayload(error), { status: 500 });
    }
}
