import { NextRequest, NextResponse } from 'next/server';
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

// GET - list users
export async function GET() {
    try {
        // Get all auth users (paginated — Supabase defaults to 50 per page)
        let authUsers: any[] = [];
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
        const { data: subscriptions } = await fastpikSupabase.from('subscriptions').select('user_id, tier, status, end_date, trial_end_date');
        const { data: profiles } = await fastpikSupabase.from('profiles').select('id, full_name');
        const { data: settings } = await fastpikSupabase.from('settings').select('user_id, vendor_name, tenant_id');
        const { data: tenants } = await fastpikSupabase.from('tenants').select('id, name, domain, is_active');

        const subMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
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
                tier: subscription?.tier || 'none',
                status: subscription?.status || 'inactive',
                expiresAt: subscription?.end_date || subscription?.trial_end_date || null,
                lastSignIn: user.last_sign_in_at || null,
                emailConfirmed: !!user.email_confirmed_at,
            };
        });

        formattedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, users: formattedUsers });
    } catch (error: any) {
        console.error('Fastpik users GET error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// POST - create trial user
export async function POST(request: NextRequest) {
    try {
        const { name, email, trialDays = 3 } = await request.json();
        const safeName = escapeTelegramHtml(name);
        const safeEmail = escapeTelegramHtml(email);

        if (!name || !email) {
            return NextResponse.json({ success: false, message: 'Name and email are required' }, { status: 400 });
        }

        const parsedTrialDays = Number.parseInt(String(trialDays), 10);
        const normalizedTrialDays = Number.isFinite(parsedTrialDays) && parsedTrialDays > 0 ? parsedTrialDays : 3;

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
    } catch (error: any) {
        console.error('Fastpik users POST error:', error);
        await notifyAlert(
            `<b>⚠️ Fastpik Invite Error</b>\n\n` +
            `❌ ${escapeTelegramHtml(error?.message || 'Unknown server error')}`
        );
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
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
    } catch (error: any) {
        console.error('Fastpik users DELETE error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
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
            const { data: currentSub } = await fastpikSupabase
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', userId)
                .single();

            const updateData: Record<string, any> = {};
            if (currentSub?.status === 'trial' || currentSub?.tier === 'free') {
                updateData.trial_end_date = expiryDate;
            } else {
                updateData.end_date = expiryDate;
            }

            const { error } = await fastpikSupabase.from('subscriptions').update(updateData).eq('user_id', userId);
            if (error) throw error;

            return NextResponse.json({ success: true, message: 'Expiry date updated' });

        } else if (action === 'change_tier') {
            let endDate = null;
            let trialEndDate = null;
            const isTrial = tier === 'free';

            if (tier !== 'lifetime') {
                const expiry = new Date();
                if (tier === 'free') { expiry.setDate(expiry.getDate() + 15); trialEndDate = expiry.toISOString(); }
                else if (tier === 'pro_monthly') { expiry.setMonth(expiry.getMonth() + 1); endDate = expiry.toISOString(); }
                else if (tier === 'pro_quarterly') { expiry.setMonth(expiry.getMonth() + 3); endDate = expiry.toISOString(); }
                else if (tier === 'pro_yearly') { expiry.setFullYear(expiry.getFullYear() + 1); endDate = expiry.toISOString(); }
            }

            const { error } = await fastpikSupabase.from('subscriptions').upsert({
                user_id: userId,
                tier,
                status: isTrial ? 'trial' : 'active',
                start_date: new Date().toISOString(),
                end_date: endDate,
                trial_end_date: trialEndDate,
            }, { onConflict: 'user_id' });

            if (error) throw error;

            return NextResponse.json({ success: true, message: `Tier changed to ${tier}` });
        }

        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Fastpik users PATCH error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
