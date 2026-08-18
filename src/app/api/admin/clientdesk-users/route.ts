import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import {
    findClientDeskMemberByEmail,
    findClientDeskMembershipByUserId,
    isClientDeskWorkspaceMember,
    listActiveClientDeskMembersForOwner,
    listClientDeskWorkspaceMemberships,
} from '@/lib/clientdesk-workspace';
import { escapeTelegramHtml, notifyAlert, notifyInfo } from '@/lib/telegram';
import {
    getClientDeskTierMetadata,
    getClientDeskTierPeriod,
    isClientDeskLifetimeTier,
    normalizeClientDeskTier,
    parseClientDeskTier,
    resolveClientDeskDuration,
    resolveClientDeskPlan,
} from '@/lib/clientdesk-subscription';
import { createPagination, parseListParams } from '@/lib/pagination';

type ClientDeskSubscription = {
    user_id: string;
    tier: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    trial_end_date: string | null;
    plan: string | null;
    duration: string | null;
};

type ClientDeskProfile = {
    id: string;
    full_name: string | null;
};

type ClientDeskMemberView = {
    id: string | null;
    membershipId: string;
    email: string;
    name: string;
    roleName: string;
    roleSlug: string | null;
    status: string;
    createdAt: string | null;
    lastSignIn: string | null;
    emailConfirmed: boolean;
};

type SubscriptionPatch = {
    trial_end_date?: string | null;
    end_date?: string | null;
    updated_at?: string;
};

const ADMIN_TRIAL_DAYS = 7;

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

function parseDateInput(value: unknown) {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// GET - list users
export async function GET(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const { requestedPage, pageSize, q } = parseListParams(request.nextUrl.searchParams);
        const packageFilter = request.nextUrl.searchParams.get('package') || 'all';
        const durationFilter = request.nextUrl.searchParams.get('duration') || 'all';
        const expiry = request.nextUrl.searchParams.get('expiry') || 'all';
        const sort = request.nextUrl.searchParams.get('sort') || 'newest';

        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_list_clientdesk_users', {
            p_page: requestedPage,
            p_page_size: pageSize,
            p_query: q,
            p_package: packageFilter,
            p_duration: durationFilter,
            p_expiry: expiry,
            p_sort: sort,
        });
        if (!rpcError && rpcData && typeof rpcData === 'object') {
            const payload = rpcData as { items?: unknown[]; pagination?: unknown; facets?: { memberCount?: number } };
            return NextResponse.json({
                success: true,
                ...payload,
                users: payload.items || [],
                memberCount: payload.facets?.memberCount || 0,
            });
        }

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

        // Get subscriptions, profiles, and workspace membership metadata.
        const [{ data: subscriptions }, { data: profiles }, memberships] = await Promise.all([
            supabase.from('subscriptions').select('user_id, tier, status, start_date, end_date, trial_end_date, plan, duration'),
            supabase.from('profiles').select('id, full_name'),
            listClientDeskWorkspaceMemberships(supabase),
        ]);

        const subMap = new Map((subscriptions || []).map((s) => {
            const subscription = s as ClientDeskSubscription;
            return [subscription.user_id, subscription] as const;
        }));
        const profileMap = new Map((profiles || []).map((p) => {
            const profile = p as ClientDeskProfile;
            return [profile.id, profile] as const;
        }));
        const authMap = new Map(authUsers.map((user) => [user.id, user] as const));
        const memberMemberships = memberships.filter(isClientDeskWorkspaceMember);
        const memberUserIds = new Set(
            memberMemberships
                .map((row) => row.member_user_id)
                .filter((id): id is string => Boolean(id)),
        );

        const formattedUsers = authUsers
            .filter((user) => !memberUserIds.has(user.id))
            .map(user => {
            const subscription = subMap.get(user.id);
            const profile = profileMap.get(user.id);
            const members: ClientDeskMemberView[] = memberMemberships
                .filter((row) => row.owner_user_id === user.id)
                .map((membership) => {
                    const memberUser = membership.member_user_id
                        ? authMap.get(membership.member_user_id)
                        : null;
                    const memberProfile = membership.member_user_id
                        ? profileMap.get(membership.member_user_id)
                        : null;
                    return {
                        id: membership.member_user_id,
                        membershipId: membership.id,
                        email: memberUser?.email || membership.email || 'No Email',
                        name:
                            memberProfile?.full_name ||
                            memberUser?.user_metadata?.full_name ||
                            membership.email.split('@')[0] ||
                            'No Name',
                        roleName: membership.role?.name || 'Member',
                        roleSlug: membership.role?.slug || null,
                        status: membership.status,
                        createdAt: memberUser?.created_at || membership.invited_at,
                        lastSignIn: memberUser?.last_sign_in_at || null,
                        emailConfirmed: Boolean(memberUser?.email_confirmed_at),
                    };
                });
            return {
                id: user.id,
                email: user.email || 'No Email',
                name: profile?.full_name || user.user_metadata?.full_name || 'No Name',
                createdAt: user.created_at,
                registeredSortAt: getLatestDate(user.email_confirmed_at, subscription?.start_date, user.created_at) || user.created_at,
                tier: subscription
                    ? normalizeClientDeskTier(subscription) || subscription.tier
                    : 'none',
                status: subscription?.status || 'inactive',
                plan: subscription ? resolveClientDeskPlan(subscription) : null,
                duration: subscription ? resolveClientDeskDuration(subscription) : null,
                expiresAt: subscription?.end_date || subscription?.trial_end_date || null,
                lastSignIn: user.last_sign_in_at || null,
                emailConfirmed: !!user.email_confirmed_at,
                members,
            };
        });

        const now = Date.now();
        const isExpiredUser = (user: typeof formattedUsers[number]) => !isClientDeskLifetimeTier(user.tier, user.duration) && !!user.expiresAt && new Date(user.expiresAt).getTime() < now;
        const packageOf = (user: typeof formattedUsers[number]) => resolveClientDeskPlan(user) || (user.tier === 'free' || user.status === 'trial' ? 'trial' : 'none');
        const durationOf = (user: typeof formattedUsers[number]) => resolveClientDeskDuration(user) || (isClientDeskLifetimeTier(user.tier, user.duration) ? 'lifetime' : null);
        const facets = {
            total: formattedUsers.length,
            packages: formattedUsers.reduce<Record<string, number>>((result, user) => { const key = packageOf(user); result[key] = (result[key] || 0) + 1; return result; }, {}),
            durations: formattedUsers.reduce<Record<string, number>>((result, user) => { const key = durationOf(user) || 'none'; result[key] = (result[key] || 0) + 1; return result; }, {}),
            expiry: { active: formattedUsers.filter((user) => !isExpiredUser(user)).length, expired: formattedUsers.filter(isExpiredUser).length },
            memberCount: 0,
        };
        const normalizedQ = q.toLowerCase();
        const filtered = formattedUsers.filter((user) => {
            if (normalizedQ && !user.name.toLowerCase().includes(normalizedQ) && !user.email.toLowerCase().includes(normalizedQ)) return false;
            if (packageFilter !== 'all' && packageOf(user) !== packageFilter) return false;
            if (durationFilter !== 'all' && durationOf(user) !== durationFilter) return false;
            if (expiry === 'active' && isExpiredUser(user)) return false;
            if (expiry === 'expired' && !isExpiredUser(user)) return false;
            return true;
        });
        facets.memberCount = filtered.reduce((count, user) => count + user.members.length, 0);
        filtered.sort((a, b) => {
            if (sort === 'expiresSoon' || sort === 'expiresLatest') {
                const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
                const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
                if (aTime !== bTime) return sort === 'expiresSoon' ? aTime - bTime : bTime - aTime;
            }
            const difference = new Date(a.registeredSortAt).getTime() - new Date(b.registeredSortAt).getTime();
            return sort === 'oldest' ? difference : -difference;
        });
        const pagination = createPagination(filtered.length, requestedPage, pageSize);
        const offset = (pagination.page - 1) * pagination.pageSize;
        const items = filtered.slice(offset, offset + pagination.pageSize);

        return NextResponse.json({ success: true, items, users: items, pagination, facets, memberCount: facets.memberCount });
    } catch (error: unknown) {
        console.error('Client Desk users GET error:', error);
        return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
    }
}

// POST - create trial user
export async function POST(request: NextRequest) {
    try {
        const supabase = getClientDeskSupabase();
        const { name, email, trialDays = ADMIN_TRIAL_DAYS } = await request.json();
        const safeName = escapeTelegramHtml(name);
        const safeEmail = escapeTelegramHtml(email);

        if (!name || !email) {
            return NextResponse.json({ success: false, message: 'Name and email are required' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const existingMember = await findClientDeskMemberByEmail(supabase, normalizedEmail);
        if (existingMember) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Email ini sudah menjadi member workspace Client Desk dan tidak dapat dibuatkan trial terpisah.',
                },
                { status: 409 },
            );
        }

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
            redirectTo: 'https://clientdesk.id/id/auth/callback?next=/id/dashboard',
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

        const membership = await findClientDeskMembershipByUserId(supabase, userId);
        if (isClientDeskWorkspaceMember(membership)) {
            return NextResponse.json(
                { success: false, message: 'Workspace member cannot be deleted from License.' },
                { status: 403 },
            );
        }

        const activeMembers = await listActiveClientDeskMembersForOwner(supabase, userId);
        if (activeMembers.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Owner masih memiliki member aktif. Nonaktifkan member dari Client Desk sebelum menghapus Owner.',
                },
                { status: 409 },
            );
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

        const membership = await findClientDeskMembershipByUserId(supabase, userId);
        if (isClientDeskWorkspaceMember(membership)) {
            return NextResponse.json(
                { success: false, message: 'Workspace member follows the Owner plan and cannot be edited.' },
                { status: 403 },
            );
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
                .select('tier, status, duration')
                .eq('user_id', userId)
                .maybeSingle();

            if (currentSubError) throw currentSubError;

            const updateData: SubscriptionPatch = {};
            const sub = currentSub as Pick<ClientDeskSubscription, 'tier' | 'status' | 'duration'> | null;
            if (sub && isClientDeskLifetimeTier(sub.tier, sub.duration)) {
                return NextResponse.json(
                    { success: false, message: 'Lifetime subscriptions do not have an expiry date' },
                    { status: 400 },
                );
            }
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
            const nextTier = parseClientDeskTier(tier);
            if (!nextTier) {
                return NextResponse.json({ success: false, message: 'Invalid tier' }, { status: 400 });
            }

            const period = getClientDeskTierPeriod(nextTier);
            const metadata = getClientDeskTierMetadata(nextTier);
            const { error } = await supabase.from('subscriptions').upsert({
                user_id: userId,
                tier: nextTier,
                plan: metadata.plan,
                duration: metadata.duration,
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
