'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type MaintenanceMode = 'off' | 'on' | 'scheduled';

type MaintenanceSettings = {
    mode: MaintenanceMode;
    announcement_enabled: boolean;
    start_at: string | null;
    end_at: string | null;
    message_id: string;
    message_en: string;
    announcement_message_id: string;
    announcement_message_en: string;
    updated_at?: string;
};

type PreviewUrls = {
    id: string;
    en: string;
};

const DEFAULT_PREVIEW_URLS: PreviewUrls = {
    id: 'https://clientdesk.ryanekoapp.web.id/id/maintenance',
    en: 'https://clientdesk.ryanekoapp.web.id/en/maintenance',
};

const DEFAULT_SETTINGS: MaintenanceSettings = {
    mode: 'scheduled',
    announcement_enabled: true,
    start_at: '2026-05-15T17:00:00.000Z',
    end_at: '2026-05-15T21:00:00.000Z',
    message_id:
        'Client Desk akan maintenance pada tanggal 16 Mei 2026 pukul 00.00-04.00 WIB. Selama periode ini, website tidak dapat digunakan sementara. Silakan coba kembali setelah maintenance selesai.',
    message_en:
        'Client Desk will be under maintenance on 16 May 2026 from 00.00-04.00 WIB. During this period, the website will be temporarily unavailable. Please try again after maintenance is complete.',
    announcement_message_id:
        'Pengumuman: Website akan maintenance pada 16 Mei 2026 pukul 00.00-04.00 WIB. Selama periode tersebut, website tidak dapat digunakan sementara.',
    announcement_message_en:
        'Announcement: The website will be under maintenance on 16 May 2026 from 00.00-04.00 WIB. During that period, the website will be temporarily unavailable.',
};

function jakartaInputValue(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function jakartaInputToIso(value: string) {
    if (!value) return null;
    const normalized = value.length === 16 ? `${value}:00+07:00` : `${value}+07:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatJakarta(value: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

function isActive(settings: MaintenanceSettings) {
    const now = Date.now();
    if (settings.mode === 'on') return true;
    if (settings.mode !== 'scheduled' || !settings.start_at || !settings.end_at) {
        return false;
    }
    return now >= new Date(settings.start_at).getTime() && now < new Date(settings.end_at).getTime();
}

function resolveStatus(settings: MaintenanceSettings) {
    if (settings.mode === 'off') return { label: 'Off', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };
    if (settings.mode === 'on') return { label: 'Maintenance aktif', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' };
    if (isActive(settings)) return { label: 'Scheduled aktif sekarang', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' };
    return { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
}

export function ClientDeskMaintenancePanel() {
    const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_SETTINGS);
    const [startInput, setStartInput] = useState(jakartaInputValue(DEFAULT_SETTINGS.start_at));
    const [endInput, setEndInput] = useState(jakartaInputValue(DEFAULT_SETTINGS.end_at));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [previewUrls, setPreviewUrls] = useState<PreviewUrls>(DEFAULT_PREVIEW_URLS);

    const status = useMemo(() => resolveStatus(settings), [settings]);

    const applySettings = (next: MaintenanceSettings) => {
        setSettings(next);
        setStartInput(jakartaInputValue(next.start_at));
        setEndInput(jakartaInputValue(next.end_at));
    };

    const fetchSettings = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch('/api/admin/clientdesk-maintenance');
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Failed to load maintenance settings');
                return;
            }
            applySettings(data.settings || DEFAULT_SETTINGS);
            setPreviewUrls(data.previewUrls || DEFAULT_PREVIEW_URLS);
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchSettings();
    }, []);

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        const payload = {
            ...settings,
            start_at: jakartaInputToIso(startInput),
            end_at: jakartaInputToIso(endInput),
        };

        try {
            const res = await fetch('/api/admin/clientdesk-maintenance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Failed to save maintenance settings');
                return;
            }
            applySettings(data.settings);
            setPreviewUrls(data.previewUrls || DEFAULT_PREVIEW_URLS);
            setSuccess('Maintenance setting saved. Client Desk will use this config within a few seconds.');
        } catch {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-5">
            <div className="bg-bg-card rounded-xl border border-border p-5 shadow-[var(--shadow)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-fg">Maintenance Control</h3>
                        <p className="mt-1 text-sm text-fg-muted">Global Client Desk lock and announcement.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                            {status.label}
                        </span>
                        <button
                            type="button"
                            onClick={fetchSettings}
                            disabled={loading || saving}
                            className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                    </div>
                ) : (
                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Mode</span>
                            <select
                                value={settings.mode}
                                onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value as MaintenanceMode }))}
                                className="w-full cursor-pointer rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            >
                                <option value="off">Off</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="on">On now</option>
                            </select>
                        </label>

                        <label className="flex min-h-[50px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2">
                            <span>
                                <span className="block text-sm font-semibold leading-5 text-fg">Announcement bar</span>
                                <span className="text-xs leading-4 text-fg-muted">Show top warning until end time.</span>
                            </span>
                            <input
                                type="checkbox"
                                checked={settings.announcement_enabled}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_enabled: event.target.checked }))}
                                className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Start (WIB)</span>
                            <input
                                type="datetime-local"
                                value={startInput}
                                onChange={(event) => setStartInput(event.target.value)}
                                className="w-full cursor-pointer rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">End (WIB)</span>
                            <input
                                type="datetime-local"
                                value={endInput}
                                onChange={(event) => setEndInput(event.target.value)}
                                className="w-full cursor-pointer rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>
                    </div>
                )}
            </div>

            {!loading && (
                <>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Page message ID</span>
                            <textarea
                                value={settings.message_id}
                                onChange={(event) => setSettings((current) => ({ ...current, message_id: event.target.value }))}
                                rows={4}
                                className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Page message EN</span>
                            <textarea
                                value={settings.message_en}
                                onChange={(event) => setSettings((current) => ({ ...current, message_en: event.target.value }))}
                                rows={4}
                                className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Announcement ID</span>
                            <textarea
                                value={settings.announcement_message_id}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_message_id: event.target.value }))}
                                rows={3}
                                className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Announcement EN</span>
                            <textarea
                                value={settings.announcement_message_en}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_message_en: event.target.value }))}
                                rows={3}
                                className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </label>
                    </div>

                    <div className="rounded-xl border border-border bg-bg-card p-5 shadow-[var(--shadow)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h4 className="text-sm font-semibold text-fg">Preview</h4>
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={previewUrls.id}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary"
                                >
                                    Preview ID
                                </a>
                                <a
                                    href={previewUrls.en}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary"
                                >
                                    Preview EN
                                </a>
                            </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-fg-secondary">
                            <p><span className="font-medium text-fg">Window:</span> {formatJakarta(jakartaInputToIso(startInput))} - {formatJakarta(jakartaInputToIso(endInput))} WIB</p>
                            <p><span className="font-medium text-fg">Banner:</span> {settings.announcement_message_id}</p>
                            <p><span className="font-medium text-fg">Page:</span> {settings.message_id}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                            {success}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="cursor-pointer rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition-all hover:opacity-85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Maintenance Setting'}
                        </button>
                    </div>
                </>
            )}
        </form>
    );
}
