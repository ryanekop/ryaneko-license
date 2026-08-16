export type MaintenanceMode = 'off' | 'on' | 'scheduled';
export type AnnouncementKind = 'warning' | 'announcement';

const MODES = new Set<MaintenanceMode>(['off', 'on', 'scheduled']);

function text(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function iso(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function kind(value: unknown): AnnouncementKind {
    return value === 'warning' ? 'warning' : 'announcement';
}

function validWindow(start: string | null, end: string | null) {
    return Boolean(start && end && new Date(end).getTime() > new Date(start).getTime());
}

export function withDualBannerDefaults(settings: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!settings) return settings;
    if ('maintenance_banner_enabled' in settings) {
        if (settings.announcement_kind === 'maintenance') {
            return {
                ...settings,
                announcement_enabled: false,
                announcement_start_at: null,
                announcement_end_at: null,
                announcement_message_id: '',
                announcement_message_en: '',
                announcement_kind: 'announcement',
                announcement_href: '',
            };
        }
        return { ...settings, announcement_kind: kind(settings.announcement_kind) };
    }

    const legacyKind = settings.announcement_kind;
    const legacyMaintenance = legacyKind === 'maintenance';
    return {
        ...settings,
        mode: legacyMaintenance ? settings.mode : 'off',
        start_at: legacyMaintenance ? settings.start_at ?? null : null,
        end_at: legacyMaintenance ? settings.end_at ?? null : null,
        maintenance_banner_enabled: legacyMaintenance && settings.announcement_enabled === true,
        maintenance_banner_start_at: null,
        maintenance_banner_end_at: legacyMaintenance ? settings.end_at ?? null : null,
        maintenance_banner_message_id: legacyMaintenance ? text(settings.announcement_message_id) : '',
        maintenance_banner_message_en: legacyMaintenance ? text(settings.announcement_message_en) : '',
        maintenance_banner_href: legacyMaintenance ? text(settings.announcement_href) : '',
        announcement_enabled: legacyMaintenance ? false : settings.announcement_enabled === true,
        announcement_start_at: legacyMaintenance ? null : settings.start_at ?? null,
        announcement_end_at: legacyMaintenance ? null : settings.end_at ?? null,
        announcement_message_id: legacyMaintenance ? '' : text(settings.announcement_message_id),
        announcement_message_en: legacyMaintenance ? '' : text(settings.announcement_message_en),
        announcement_kind: legacyMaintenance ? 'announcement' : kind(legacyKind),
        announcement_href: legacyMaintenance ? '' : text(settings.announcement_href),
    };
}

export function validateDualBannerPayload(body: Record<string, unknown>) {
    const mode = text(body.mode) as MaintenanceMode;
    if (!MODES.has(mode)) return { error: 'Invalid maintenance mode.' } as const;

    const startAt = iso(body.start_at);
    const endAt = iso(body.end_at);
    const maintenanceBannerStartAt = iso(body.maintenance_banner_start_at);
    const maintenanceBannerEndAt = iso(body.maintenance_banner_end_at);
    const announcementStartAt = iso(body.announcement_start_at);
    const announcementEndAt = iso(body.announcement_end_at);
    const maintenanceBannerEnabled = body.maintenance_banner_enabled === true;
    const announcementEnabled = body.announcement_enabled === true;

    if ((mode === 'on' || mode === 'scheduled') && !validWindow(startAt, endAt)) {
        return { error: 'Maintenance start and end time are required and must be ordered.' } as const;
    }
    if (maintenanceBannerEnabled && !validWindow(maintenanceBannerStartAt, maintenanceBannerEndAt)) {
        return { error: 'Maintenance banner start and end time are required and must be ordered.' } as const;
    }
    if (announcementEnabled && !validWindow(announcementStartAt, announcementEndAt)) {
        return { error: 'Announcement start and end time are required and must be ordered.' } as const;
    }

    const messageId = text(body.message_id);
    const messageEn = text(body.message_en);
    const maintenanceBannerMessageId = text(body.maintenance_banner_message_id);
    const maintenanceBannerMessageEn = text(body.maintenance_banner_message_en);
    const announcementMessageId = text(body.announcement_message_id);
    const announcementMessageEn = text(body.announcement_message_en);

    if (!messageId || !messageEn) return { error: 'Maintenance page messages are required.' } as const;
    if (maintenanceBannerEnabled && (!maintenanceBannerMessageId || !maintenanceBannerMessageEn)) {
        return { error: 'Maintenance banner messages are required.' } as const;
    }
    if (announcementEnabled && (!announcementMessageId || !announcementMessageEn)) {
        return { error: 'Announcement messages are required.' } as const;
    }

    return {
        data: {
            id: 'global',
            mode,
            start_at: startAt,
            end_at: endAt,
            message_id: messageId,
            message_en: messageEn,
            maintenance_banner_enabled: maintenanceBannerEnabled,
            maintenance_banner_start_at: maintenanceBannerStartAt,
            maintenance_banner_end_at: maintenanceBannerEndAt,
            maintenance_banner_message_id: maintenanceBannerMessageId,
            maintenance_banner_message_en: maintenanceBannerMessageEn,
            maintenance_banner_href: text(body.maintenance_banner_href),
            announcement_enabled: announcementEnabled,
            announcement_start_at: announcementStartAt,
            announcement_end_at: announcementEndAt,
            announcement_message_id: announcementMessageId,
            announcement_message_en: announcementMessageEn,
            announcement_kind: kind(body.announcement_kind),
            announcement_href: text(body.announcement_href),
        },
    } as const;
}
