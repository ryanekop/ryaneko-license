import { NextRequest, NextResponse } from 'next/server';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';

// Direct connection to Fastpik Supabase (bypasses Vercel Attack Challenge)
const fastpikSupabase = getFastpikSupabase();

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

        // Get subscriptions and profiles
        const { data: subscriptions } = await fastpikSupabase.from('subscriptions').select('user_id, tier, status, end_date, trial_end_date');
        const { data: profiles } = await fastpikSupabase.from('profiles').select('id, full_name');

        const subMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const formattedUsers = authUsers.map(user => {
            const subscription = subMap.get(user.id);
            const profile = profileMap.get(user.id);
            return {
                id: user.id,
                email: user.email || 'No Email',
                name: profile?.full_name || user.user_metadata?.full_name || 'No Name',
                createdAt: user.created_at,
                tier: subscription?.tier || 'none',
                status: subscription?.status || 'inactive',
                expiresAt: subscription?.end_date || subscription?.trial_end_date || null,
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

        if (!name || !email) {
            return NextResponse.json({ success: false, message: 'Name and email are required' }, { status: 400 });
        }

        // Invite user by email
        const { data: authData, error: authError } = await fastpikSupabase.auth.admin.inviteUserByEmail(email, {
            data: { full_name: name },
            redirectTo: 'https://fastpik.ryanekoapp.web.id/auth/callback',
        });

        if (authError) {
            return NextResponse.json({ success: false, message: authError.message }, { status: 400 });
        }

        if (!authData.user) {
            return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 });
        }

        // Create profile
        await fastpikSupabase.from('profiles').insert({
            id: authData.user.id,
            email,
            full_name: name,
        });

        // Create trial subscription
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + parseInt(trialDays));

        await fastpikSupabase.from('subscriptions').insert({
            user_id: authData.user.id,
            tier: 'free',
            status: 'trial',
            start_date: new Date().toISOString(),
            trial_end_date: trialEndDate.toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Invitation sent! User will receive email to set their password.',
            user: { id: authData.user.id, email: authData.user.email, name },
        });
    } catch (error: any) {
        console.error('Fastpik users POST error:', error);
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
        const { userId, action, tier, expiryDate } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
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
