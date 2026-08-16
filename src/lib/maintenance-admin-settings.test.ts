import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDualBannerPayload, withDualBannerDefaults } from './maintenance-admin-settings.ts';

const basePayload = {
    mode: 'scheduled',
    start_at: '2026-08-16T16:00:00.000Z',
    end_at: '2026-08-16T18:00:00.000Z',
    message_id: 'Maintenance.',
    message_en: 'Maintenance.',
    maintenance_banner_enabled: true,
    maintenance_banner_start_at: '2026-08-16T01:00:00.000Z',
    maintenance_banner_end_at: '2026-08-16T18:00:00.000Z',
    maintenance_banner_message_id: 'Maintenance malam ini.',
    maintenance_banner_message_en: 'Maintenance tonight.',
    maintenance_banner_href: '',
    announcement_enabled: true,
    announcement_start_at: '2026-08-16T02:00:00.000Z',
    announcement_end_at: '2026-08-18T02:00:00.000Z',
    announcement_message_id: 'Fitur baru.',
    announcement_message_en: 'New feature.',
    announcement_kind: 'warning',
    announcement_href: '/pricing',
};

test('validates three independent windows', () => {
    const result = validateDualBannerPayload(basePayload);
    if (!result.data) assert.fail(result.error);
    assert.equal(result.data.announcement_kind, 'warning');
    assert.equal(result.data.maintenance_banner_enabled, true);
});

test('rejects an invalid announcement window without affecting lock validation', () => {
    const result = validateDualBannerPayload({
        ...basePayload,
        announcement_end_at: basePayload.announcement_start_at,
    });
    assert.deepEqual(result, {
        error: 'Announcement start and end time are required and must be ordered.',
    });
});

test('maps a legacy maintenance announcement into the maintenance slot', () => {
    const result = withDualBannerDefaults({
        announcement_enabled: true,
        announcement_kind: 'maintenance',
        announcement_message_id: 'Maintenance malam ini.',
        announcement_message_en: 'Maintenance tonight.',
        announcement_href: '',
        end_at: '2026-08-16T18:00:00.000Z',
    });
    assert.equal(result?.maintenance_banner_enabled, true);
    assert.equal(result?.announcement_enabled, false);
    assert.equal(result?.maintenance_banner_message_id, 'Maintenance malam ini.');
});

test('does not duplicate a migrated maintenance banner into the general slot', () => {
    const result = withDualBannerDefaults({
        maintenance_banner_enabled: true,
        maintenance_banner_message_id: 'Maintenance malam ini.',
        announcement_enabled: true,
        announcement_kind: 'maintenance',
        announcement_message_id: 'Maintenance malam ini.',
    });
    assert.equal(result?.maintenance_banner_enabled, true);
    assert.equal(result?.announcement_enabled, false);
    assert.equal(result?.announcement_kind, 'announcement');
});

test('does not turn a legacy general-banner schedule into a full lock', () => {
    const result = withDualBannerDefaults({
        mode: 'scheduled',
        start_at: '2026-08-16T02:00:00.000Z',
        end_at: '2026-08-18T02:00:00.000Z',
        announcement_enabled: true,
        announcement_kind: 'warning',
        announcement_message_id: 'Info.',
        announcement_message_en: 'Info.',
    });
    assert.equal(result?.mode, 'off');
    assert.equal(result?.start_at, null);
    assert.equal(result?.announcement_start_at, '2026-08-16T02:00:00.000Z');
});
