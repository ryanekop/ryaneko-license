import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getFastpikSupabase } from '@/lib/fastpik-supabase';
import { validateDualBannerPayload, withDualBannerDefaults } from '@/lib/maintenance-admin-settings';

const PREVIEW_BASE = process.env.FASTPIK_API_URL || 'https://fastpik.id';

function previewUrls() {
    const base = PREVIEW_BASE.replace(/\/+$/, '');
    return { id: `${base}/id/maintenance`, en: `${base}/en/maintenance` };
}

async function authorize(request: NextRequest) {
    const auth = await requireAdmin(request);
    return auth.ok ? null : auth.response;
}

export async function GET(request: NextRequest) {
    const authError = await authorize(request);
    if (authError) return authError;
    try {
        const { data, error } = await getFastpikSupabase()
            .from('platform_maintenance_settings')
            .select('*')
            .eq('id', 'global')
            .maybeSingle();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        return NextResponse.json({
            success: true,
            settings: withDualBannerDefaults(data as Record<string, unknown> | null),
            previewUrls: previewUrls(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authError = await authorize(request);
    if (authError) return authError;
    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ success: false, error: 'Invalid payload.' }, { status: 400 });
        }
        const validated = validateDualBannerPayload(body as Record<string, unknown>);
        if ('error' in validated) {
            return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
        }
        const { data, error } = await getFastpikSupabase()
            .from('platform_maintenance_settings')
            .upsert(validated.data, { onConflict: 'id' })
            .select('*')
            .single();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        return NextResponse.json({
            success: true,
            settings: withDualBannerDefaults(data as Record<string, unknown>),
            previewUrls: previewUrls(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
