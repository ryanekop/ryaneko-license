import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { escapeTelegramHtml, notifyAlert, notifyInfo } from '@/lib/telegram';

type ClientDeskSubscription = {
    user_id: string;
    tier: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    trial_end_date: string | null;
};

type ClientDeskProfile = {
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
        const supabase = getClientDeskSupabase();

        // Get all auth users (paginated)
        let authUsers: User[] = [];
        let page = 1;
        while (true) {
            const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (authError) throw authError;
            const users = authData?.users || [];
            authUsers = authUsers.concat(users);
            if (users.length < 1000) break;
            page++;
        }

        // Get subscriptions and profiles
        const { data: subscriptions } = await supabase.from('subscriptions').select('user_id, tier, status, start_date, end_date, trial_end_date');
        const { data: profiles } = await supabase.from('profiles').select('id, full_name');

        const subMap = new Map((subscriptions || []).map((s) => {
            const subscription = s as ClientDeskSubscription;
            return [subscription.user_id, subscription] as const;
        }));
        const profileMap = new Map((profiles || []).map((p) => {
            const profile = p as ClientDeskProfile;
            return [profile.id, profile] as const;
        }));

        const formattedUsers = authUsers.map(user => {
            const subscription = subMap.get(user.id);
            const profile = profileMap.get(user.id);
            return {
                id: user.id,
                email: user.email || 'No Email',
                name: profile?.full_name || user.user_metadata?.full_name || 'No Name',
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
        console.error('Client Desk users GET error:', error);
        return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
    }
}

// POST - create trial user
export async function POST(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const { name, email, trialDays = 5 } = await request.json();
        const safeName = escapeTelegramHtml(name);
        const safeEmail = escapeTelegramHtml(email);

        if (!name || !email) {
            return NextResponse.json({ success: false, message: 'Name and email are required' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const { data: activeBlock, error: blockError } = await supabase
            .from('auth_email_blocklist')
            .select('id')
            .eq('email', normalizedEmail)
            .eq('is_active', true)
            .maybeSingle();

        if (blockError) {
            throw blockError;
        }

        if (activeBlock) {
            return NextResponse.json(
                { success: false, message: 'This Client Desk account is currently unavailable.' },
                { status: 403 }
            );
        }

        const parsedTrialDays = Number.parseInt(String(trialDays), 10);
        const normalizedTrialDays = Number.isFinite(parsedTrialDays) && parsedTrialDays > 0 ? parsedTrialDays : 5;

        // Invite user by email
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
            data: { full_name: name },
            redirectTo: 'https://clientdesk.ryanekoapp.web.id/id/auth/callback?next=/id/dashboard',
        });

        if (authError) {
            await notifyAlert(
                `<b>⚠️ Client Desk Invite Failed</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `❌ ${escapeTelegramHtml(authError.message)}`
            );
            return NextResponse.json({ success: false, message: authError.message }, { status: 400 });
        }

        if (!authData.user) {
            await notifyAlert(
                `<b>⚠️ Client Desk Invite Failed</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `❌ Missing user payload from Supabase`
            );
            return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 });
        }

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            full_name: name,
        });
        if (profileError) {
            await notifyAlert(
                `<b>⚠️ Client Desk Invite Partial Failure</b>\n\n` +
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

        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
            user_id: authData.user.id,
            tier: 'free',
            status: 'trial',
            start_date: new Date().toISOString(),
            trial_end_date: trialEndDate.toISOString(),
        });
        if (subscriptionError) {
            await notifyAlert(
                `<b>⚠️ Client Desk Invite Partial Failure</b>\n\n` +
                `👤 ${safeName}\n` +
                `📧 ${safeEmail}\n` +
                `🆔 ${escapeTelegramHtml(authData.user.id)}\n` +
                `❌ Subscription insert: ${escapeTelegramHtml(subscriptionError.message)}`
            );
            return NextResponse.json({ success: false, message: subscriptionError.message }, { status: 500 });
        }

        await notifyInfo(
            `<b>Client Desk Invite Sent</b>\n\n` +
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
        console.error('Client Desk users POST error:', error);
        const message = getErrorMessage(error);
        await notifyAlert(
            `<b>⚠️ Client Desk Invite Error</b>\n\n` +
            `❌ ${escapeTelegramHtml(message)}`
        );
        return NextResponse.json({ success: false, message }, { status: 500 });
    }
}

// DELETE - delete user
export async function DELETE(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
        }

        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error: unknown) {
        console.error('Client Desk users DELETE error:', error);
        return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
    }
}

// PATCH - edit user (set_expiry, change_tier)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const { userId, action, tier, expiryDate } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
        }

        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !userData?.user) {
            return NextResponse.json(
                { success: false, message: userError?.message || 'Client Desk user not found' },
                { status: 404 },
            );
        }

        if (action === 'set_expiry') {
            const parsedExpiryDate = parseDateInput(expiryDate);
            if (!parsedExpiryDate) {
                return NextResponse.json({ success: false, message: 'Valid expiry date is required' }, { status: 400 });
            }

            const { data: currentSub, error: currentSubError } = await supabase
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', userId)
                .maybeSingle();

            if (currentSubError) throw currentSubError;

            const updateData: SubscriptionPatch = {};
            const sub = currentSub as Pick<ClientDeskSubscription, 'tier' | 'status'> | null;
            if (!sub || sub.status === 'trial' || sub.tier === 'free') {
                updateData.trial_end_date = parsedExpiryDate;
                updateData.end_date = null;
            } else {
                updateData.end_date = parsedExpiryDate;
            }
            updateData.updated_at = new Date().toISOString();

            const { error } = sub
                ? await supabase.from('subscriptions').update(updateData).eq('user_id', userId)
                : await supabase.from('subscriptions').insert({
                    user_id: userId,
                    tier: 'free',
                    status: 'trial',
                    start_date: new Date().toISOString(),
                    ...updateData,
                });
            if (error) throw error;

            return NextResponse.json({ success: true, message: 'Expiry date updated' });

        } else if (action === 'change_tier') {
            const nextTier = parseTier(tier);
            if (!nextTier) {
                return NextResponse.json({ success: false, message: 'Invalid tier' }, { status: 400 });
            }

            const period = getTierPeriod(nextTier);
            const { error } = await supabase.from('subscriptions').upsert({
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
        console.error('Client Desk users PATCH error:', error);
        return NextResponse.json(getErrorPayload(error), { status: 500 });
    }
}
