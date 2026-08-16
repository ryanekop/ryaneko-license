'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type MaintenanceMode = 'off' | 'on' | 'scheduled';
type AnnouncementKind = 'warning' | 'announcement';

type MaintenanceSettings = {
    mode: MaintenanceMode;
    start_at: string | null;
    end_at: string | null;
    message_id: string;
    message_en: string;
    maintenance_banner_enabled: boolean;
    maintenance_banner_start_at: string | null;
    maintenance_banner_end_at: string | null;
    maintenance_banner_message_id: string;
    maintenance_banner_message_en: string;
    maintenance_banner_href: string;
    announcement_enabled: boolean;
    announcement_start_at: string | null;
    announcement_end_at: string | null;
    announcement_message_id: string;
    announcement_message_en: string;
    announcement_kind: AnnouncementKind;
    announcement_href: string;
};

type TimeInputs = {
    start_at: string;
    end_at: string;
    maintenance_banner_start_at: string;
    maintenance_banner_end_at: string;
    announcement_start_at: string;
    announcement_end_at: string;
};

type PanelConfig = {
    productName: string;
    endpoint: string;
    previewUrls: { id: string; en: string };
    linkExample: string;
    defaults: MaintenanceSettings;
};

const commonDefaults = {
    mode: 'off' as const,
    start_at: null,
    end_at: null,
    maintenance_banner_enabled: false,
    maintenance_banner_start_at: null,
    maintenance_banner_end_at: null,
    maintenance_banner_href: '',
    announcement_enabled: false,
    announcement_start_at: null,
    announcement_end_at: null,
    announcement_kind: 'announcement' as const,
    announcement_href: '',
};

const CLIENTDESK_CONFIG: PanelConfig = {
    productName: 'Client Desk',
    endpoint: '/api/admin/clientdesk-maintenance',
    previewUrls: { id: 'https://clientdesk.id/id/maintenance', en: 'https://clientdesk.id/en/maintenance' },
    linkExample: '/pricing#plus',
    defaults: {
        ...commonDefaults,
        message_id: 'Client Desk sedang menjalani maintenance. Silakan coba kembali setelah proses maintenance selesai.',
        message_en: 'Client Desk is currently undergoing maintenance. Please try again after maintenance is complete.',
        maintenance_banner_message_id: 'Client Desk akan menjalani maintenance.',
        maintenance_banner_message_en: 'Client Desk will undergo maintenance.',
        announcement_message_id: 'Pengumuman Client Desk.',
        announcement_message_en: 'Client Desk announcement.',
    },
};

const FASTPIK_CONFIG: PanelConfig = {
    productName: 'Fastpik',
    endpoint: '/api/admin/fastpik-maintenance',
    previewUrls: { id: 'https://fastpik.id/id/maintenance', en: 'https://fastpik.id/en/maintenance' },
    linkExample: '/id/pricing',
    defaults: {
        ...commonDefaults,
        message_id: 'Fastpik sedang menjalani maintenance. Silakan coba kembali setelah proses maintenance selesai.',
        message_en: 'Fastpik is currently undergoing maintenance. Please try again after maintenance is complete.',
        maintenance_banner_message_id: 'Fastpik akan menjalani maintenance.',
        maintenance_banner_message_en: 'Fastpik will undergo maintenance.',
        announcement_message_id: 'Pengumuman Fastpik.',
        announcement_message_en: 'Fastpik announcement.',
    },
};

const timeKeys: Array<keyof TimeInputs> = [
    'start_at', 'end_at',
    'maintenance_banner_start_at', 'maintenance_banner_end_at',
    'announcement_start_at', 'announcement_end_at',
];

function jakartaInputValue(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function jakartaInputToIso(value: string) {
    if (!value) return null;
    const date = new Date(value.length === 16 ? `${value}:00+07:00` : `${value}+07:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildTimeInputs(settings: MaintenanceSettings): TimeInputs {
    return Object.fromEntries(timeKeys.map((key) => [key, jakartaInputValue(settings[key])])) as TimeInputs;
}

function isWithin(start: string, end: string) {
    const startDate = jakartaInputToIso(start);
    const endDate = jakartaInputToIso(end);
    const now = Date.now();
    return Boolean(startDate && endDate && now >= new Date(startDate).getTime() && now < new Date(endDate).getTime());
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
            {children}
            {hint ? <span className="block text-xs leading-4 text-fg-muted">{hint}</span> : null}
        </label>
    );
}

const inputClass = 'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20';
const textareaClass = 'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20';

function PlatformMaintenancePanel({ config }: { config: PanelConfig }) {
    const [settings, setSettings] = useState(config.defaults);
    const [times, setTimes] = useState<TimeInputs>(buildTimeInputs(config.defaults));
    const [previewUrls, setPreviewUrls] = useState(config.previewUrls);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const applySettings = useCallback((incoming: Partial<MaintenanceSettings>) => {
        const next = { ...config.defaults, ...incoming };
        setSettings(next);
        setTimes(buildTimeInputs(next));
    }, [config.defaults]);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(config.endpoint);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load maintenance settings');
            applySettings(data.settings || config.defaults);
            setPreviewUrls(data.previewUrls || config.previewUrls);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'Connection error');
        } finally {
            setLoading(false);
        }
    }, [applySettings, config.defaults, config.endpoint, config.previewUrls]);

    useEffect(() => { void fetchSettings(); }, [fetchSettings]);

    const status = useMemo(() => {
        const lockActive = settings.mode === 'on' || (settings.mode === 'scheduled' && isWithin(times.start_at, times.end_at));
        const activeBanners = Number(settings.maintenance_banner_enabled && isWithin(times.maintenance_banner_start_at, times.maintenance_banner_end_at))
            + Number(settings.announcement_enabled && isWithin(times.announcement_start_at, times.announcement_end_at));
        if (lockActive) return { label: 'Maintenance aktif', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' };
        if (activeBanners) return { label: `${activeBanners} banner aktif`, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
        return { label: settings.mode === 'scheduled' ? 'Scheduled' : 'Off', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };
    }, [settings, times]);

    const updateTime = (key: keyof TimeInputs, value: string) => setTimes((current) => ({ ...current, [key]: value }));

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        const payload = { ...settings, ...Object.fromEntries(timeKeys.map((key) => [key, jakartaInputToIso(times[key])])) };
        try {
            const response = await fetch(config.endpoint, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save maintenance settings');
            applySettings(data.settings);
            setSuccess(`Settings saved. ${config.productName} will refresh them within a few seconds.`);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Connection error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-5">
            <div className="rounded-xl border border-border bg-bg-card p-5 shadow-[var(--shadow)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-fg">Maintenance & Notification Control</h3>
                        <p className="mt-1 text-sm text-fg-muted">Independent full lock, maintenance notice, and general announcement for {config.productName}.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                        <button type="button" onClick={fetchSettings} disabled={loading || saving} className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary disabled:opacity-50">Refresh</button>
                    </div>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" /></div> : (
                <>
                    <section className="space-y-4 rounded-xl border border-border bg-bg-card p-5 shadow-[var(--shadow)]">
                        <div><h4 className="font-semibold text-fg">Maintenance Lock</h4><p className="text-xs text-fg-muted">Controls redirect and the maintenance page only.</p></div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Field label="Mode"><select value={settings.mode} onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value as MaintenanceMode }))} className={inputClass}><option value="off">Off</option><option value="scheduled">Scheduled</option><option value="on">On now</option></select></Field>
                            <div />
                            <Field label="Lock start (WIB)"><input type="datetime-local" value={times.start_at} onChange={(event) => updateTime('start_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Lock end (WIB)"><input type="datetime-local" value={times.end_at} onChange={(event) => updateTime('end_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Page message ID"><textarea rows={3} value={settings.message_id} onChange={(event) => setSettings((current) => ({ ...current, message_id: event.target.value }))} className={textareaClass} /></Field>
                            <Field label="Page message EN"><textarea rows={3} value={settings.message_en} onChange={(event) => setSettings((current) => ({ ...current, message_en: event.target.value }))} className={textareaClass} /></Field>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-xl border border-red-300 bg-bg-card p-5 shadow-[var(--shadow)]">
                        <div className="flex items-center justify-between gap-4"><div><h4 className="font-semibold text-fg">Maintenance Notification</h4><p className="text-xs text-fg-muted">Red, static, and cannot be dismissed.</p></div><input type="checkbox" checked={settings.maintenance_banner_enabled} onChange={(event) => setSettings((current) => ({ ...current, maintenance_banner_enabled: event.target.checked }))} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" /></div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Field label="Banner start (WIB)"><input type="datetime-local" value={times.maintenance_banner_start_at} onChange={(event) => updateTime('maintenance_banner_start_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Banner end (WIB)"><input type="datetime-local" value={times.maintenance_banner_end_at} onChange={(event) => updateTime('maintenance_banner_end_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Message ID"><textarea rows={3} value={settings.maintenance_banner_message_id} onChange={(event) => setSettings((current) => ({ ...current, maintenance_banner_message_id: event.target.value }))} className={textareaClass} /></Field>
                            <Field label="Message EN"><textarea rows={3} value={settings.maintenance_banner_message_en} onChange={(event) => setSettings((current) => ({ ...current, maintenance_banner_message_en: event.target.value }))} className={textareaClass} /></Field>
                            <Field label="Banner link" hint={`Use ${config.linkExample} or a full URL.`}><input value={settings.maintenance_banner_href} onChange={(event) => setSettings((current) => ({ ...current, maintenance_banner_href: event.target.value }))} className={inputClass} /></Field>
                        </div>
                        <div className="rounded-lg border border-red-700 bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">{settings.maintenance_banner_message_id || 'Maintenance notification preview'}</div>
                    </section>

                    <section className="space-y-4 rounded-xl border border-emerald-300 bg-bg-card p-5 shadow-[var(--shadow)]">
                        <div className="flex items-center justify-between gap-4"><div><h4 className="font-semibold text-fg">General Announcement</h4><p className="text-xs text-fg-muted">Warning or announcement with independent dismiss state.</p></div><input type="checkbox" checked={settings.announcement_enabled} onChange={(event) => setSettings((current) => ({ ...current, announcement_enabled: event.target.checked }))} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" /></div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Field label="Banner type"><select value={settings.announcement_kind} onChange={(event) => setSettings((current) => ({ ...current, announcement_kind: event.target.value as AnnouncementKind }))} className={inputClass}><option value="warning">Warning</option><option value="announcement">Pengumuman</option></select></Field>
                            <Field label="Banner link" hint={`Use ${config.linkExample} or a full URL.`}><input value={settings.announcement_href} onChange={(event) => setSettings((current) => ({ ...current, announcement_href: event.target.value }))} className={inputClass} /></Field>
                            <Field label="Banner start (WIB)"><input type="datetime-local" value={times.announcement_start_at} onChange={(event) => updateTime('announcement_start_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Banner end (WIB)"><input type="datetime-local" value={times.announcement_end_at} onChange={(event) => updateTime('announcement_end_at', event.target.value)} className={inputClass} /></Field>
                            <Field label="Message ID"><textarea rows={3} value={settings.announcement_message_id} onChange={(event) => setSettings((current) => ({ ...current, announcement_message_id: event.target.value }))} className={textareaClass} /></Field>
                            <Field label="Message EN"><textarea rows={3} value={settings.announcement_message_en} onChange={(event) => setSettings((current) => ({ ...current, announcement_message_en: event.target.value }))} className={textareaClass} /></Field>
                        </div>
                        <div className={`overflow-hidden rounded-lg border px-4 py-2 text-sm font-semibold ${settings.announcement_kind === 'warning' ? 'border-yellow-400 bg-yellow-300 text-yellow-950' : 'border-emerald-600 bg-emerald-600 text-white'}`}>{settings.announcement_message_id || 'Announcement preview'}</div>
                    </section>

                    <section className="rounded-xl border border-border bg-bg-card p-5 shadow-[var(--shadow)]">
                        <div className="flex flex-wrap items-center gap-2"><a href={previewUrls.id} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary">Preview ID</a><a href={previewUrls.en} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-fg hover:bg-bg-secondary">Preview EN</a></div>
                    </section>
                </>
            )}

            {error ? <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div> : null}
            {success ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</div> : null}
            <div className="flex justify-end"><button type="submit" disabled={loading || saving} className="cursor-pointer rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg hover:opacity-85 disabled:opacity-50">{saving ? 'Saving...' : 'Save Settings'}</button></div>
        </form>
    );
}

export function ClientDeskMaintenancePanel() { return <PlatformMaintenancePanel config={CLIENTDESK_CONFIG} />; }
export function FastpikMaintenancePanel() { return <PlatformMaintenancePanel config={FASTPIK_CONFIG} />; }
