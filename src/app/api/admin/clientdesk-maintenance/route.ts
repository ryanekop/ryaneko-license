import { NextRequest, NextResponse } from 'next/server';
import { getClientDeskSupabase } from '@/lib/clientdesk-supabase';
import { isSameOriginRequest, verifyAdminRequest } from '@/lib/admin-session';

type MaintenanceMode = 'off' | 'on' | 'scheduled';

const SETTINGS_ID = 'global';
const MODES = new Set<MaintenanceMode>(['off', 'on', 'scheduled']);

function unauthorized() {
    return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
    );
}

function forbidden() {
    return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
    );
}

function assertAdmin(request: NextRequest) {
    if (!verifyAdminRequest(request)) return unauthorized();
    if (!isSameOriginRequest(request)) return forbidden();
    return null;
}

function normalizeIso(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function validatePayload(body: Record<string, unknown>) {
    const mode = normalizeText(body.mode) as MaintenanceMode;
    if (!MODES.has(mode)) {
        return { error: 'Invalid maintenance mode.' };
    }

    const startAt = normalizeIso(body.start_at);
    const endAt = normalizeIso(body.end_at);
    if ((mode === 'on' || mode === 'scheduled') && (!startAt || !endAt)) {
        return { error: 'Start and end time are required.' };
    }

    if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        return { error: 'End time must be after start time.' };
    }

    const messageId = normalizeText(body.message_id);
    const messageEn = normalizeText(body.message_en);
    const announcementMessageId = normalizeText(body.announcement_message_id);
    const announcementMessageEn = normalizeText(body.announcement_message_en);

    if (!messageId || !messageEn || !announcementMessageId || !announcementMessageEn) {
        return { error: 'All maintenance messages are required.' };
    }

    return {
        data: {
            id: SETTINGS_ID,
            mode,
            announcement_enabled: body.announcement_enabled === true,
            start_at: startAt,
            end_at: endAt,
            message_id: messageId,
            message_en: messageEn,
            announcement_message_id: announcementMessageId,
            announcement_message_en: announcementMessageEn,
        },
    };
}

export async function GET(request: NextRequest) {
    const authError = assertAdmin(request);
    if (authError) return authError;

    try {
        const supabase = getClientDeskSupabase();
        const { data, error } = await supabase
            .from('platform_maintenance_settings')
            .select('*')
            .eq('id', SETTINGS_ID)
            .maybeSingle();

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true, settings: data || null });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authError = assertAdmin(request);
    if (authError) return authError;

    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid payload.' },
                { status: 400 },
            );
        }

        const validated = validatePayload(body as Record<string, unknown>);
        if ('error' in validated) {
            return NextResponse.json(
                { success: false, error: validated.error },
                { status: 400 },
            );
        }

        const supabase = getClientDeskSupabase();
        const { data, error } = await supabase
            .from('platform_maintenance_settings')
            .upsert(validated.data, { onConflict: 'id' })
            .select('*')
            .single();

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true, settings: data });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
