'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminModal } from '@/components/AdminModal';
import { Pagination } from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, type PageSize, type PaginationMeta } from '@/lib/pagination';
import {
    CLIENTDESK_EMAIL_DOMAIN_STATUSES,
    normalizeClientDeskDnsRecord,
    validateClientDeskEmailDomainDraft,
    type ClientDeskDnsRecord as DnsRecord,
    type ClientDeskDnsRecordType as DnsRecordType,
    type ClientDeskEmailDomainDraft as DomainDraft,
    type ClientDeskEmailDomainStatus as DomainStatus,
} from '@/lib/clientdesk-email-domains';

const DOMAIN_STATUSES = CLIENTDESK_EMAIL_DOMAIN_STATUSES;

interface EmailDomainRow {
    user_id: string;
    domain: string;
    status: DomainStatus;
    dns_records: DnsRecord[];
    provider_domain_id: string | null;
    admin_note: string | null;
    submitted_at: string;
    verified_at: string | null;
    profiles?: { studio_name?: string | null } | Array<{ studio_name?: string | null }> | null;
}

const inputClass = 'w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50';

function studioName(row: EmailDomainRow) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return profile?.studio_name?.trim() || 'Studio tanpa nama';
}

function formatDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function statusLabel(status: DomainStatus) {
    return {
        pending_admin: 'Menunggu Admin',
        dns_pending: 'Menunggu DNS',
        dns_detected: 'DNS Terdeteksi',
        verified: 'Terverifikasi',
        rejected: 'Ditolak',
        failed: 'Gagal',
    }[status];
}

function statusClass(status: DomainStatus) {
    if (status === 'verified') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
    if (status === 'dns_detected') return 'bg-sky-500/10 text-sky-600 dark:text-sky-300';
    if (status === 'dns_pending') return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
    if (status === 'rejected' || status === 'failed') return 'bg-red-500/10 text-red-600 dark:text-red-300';
    return 'bg-gray-500/10 text-fg-secondary';
}

function EditDialog({
    open,
    row,
    saving,
    error,
    onClose,
    onSave,
}: {
    open: boolean;
    row: EmailDomainRow;
    saving: boolean;
    error: string;
    onClose: () => void;
    onSave: (draft: DomainDraft) => void;
}) {
    const [draft, setDraft] = useState<DomainDraft>(() => ({
        status: row.status,
        providerDomainId: row.provider_domain_id || '',
        adminNote: row.admin_note || '',
        dnsRecords: (row.dns_records || []).map((record) => ({ ...record })),
    }));

    function updateRecord(index: number, patch: Partial<DnsRecord>) {
        setDraft((current) => ({
            ...current,
            dnsRecords: current.dnsRecords.map((record, recordIndex) =>
                recordIndex === index ? { ...record, ...patch } : record,
            ),
        }));
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        onSave({
            ...draft,
            providerDomainId: draft.providerDomainId.trim(),
            adminNote: draft.adminNote.trim(),
            dnsRecords: draft.dnsRecords.map((record) => ({
                type: record.type,
                name: record.name.trim(),
                value: record.value.trim(),
                ...(record.type === 'MX' ? { priority: Number(record.priority || 0) } : {}),
            })),
        });
    }

    return (
        <AdminModal open={open} onClose={onClose} closeDisabled={saving} className="max-w-4xl">
            <form onSubmit={submit}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-fg">Proses Domain Email</h3>
                        <p className="mt-1 text-sm text-fg-muted">{studioName(row)} · {row.domain}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-secondary">Tutup</button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-fg-secondary">
                        Status
                        <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as DomainStatus }))} className={inputClass}>
                            {DOMAIN_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1.5 text-sm text-fg-secondary">
                        Provider Domain ID Sumopod
                        <input value={draft.providerDomainId} onChange={(event) => setDraft((current) => ({ ...current, providerDomainId: event.target.value }))} className={inputClass} placeholder="ID domain dari Sumopod" />
                    </label>
                </div>

                <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div><h4 className="text-sm font-semibold text-fg">DNS Records</h4><p className="text-xs text-fg-muted">Salin persis record yang diberikan Sumopod.</p></div>
                        <button type="button" onClick={() => setDraft((current) => ({ ...current, dnsRecords: [...current.dnsRecords, { type: 'TXT', name: '', value: '' }] }))} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:opacity-85">+ Tambah Record</button>
                    </div>
                    {draft.dnsRecords.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">Belum ada DNS record.</div>
                    ) : draft.dnsRecords.map((record, index) => (
                        <div key={index} className="grid gap-2 rounded-xl border border-border bg-bg p-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.5fr)_90px_auto]">
                            <select value={record.type} onChange={(event) => updateRecord(index, { type: event.target.value as DnsRecordType })} className={inputClass}>
                                <option value="TXT">TXT</option><option value="CNAME">CNAME</option><option value="MX">MX</option>
                            </select>
                            <input value={record.name} onChange={(event) => updateRecord(index, { name: event.target.value })} className={inputClass} placeholder="Name / Host" required />
                            <input value={record.value} onChange={(event) => updateRecord(index, { value: event.target.value })} className={inputClass} placeholder="Value / Target" required />
                            <input type="number" min="0" max="65535" value={record.type === 'MX' ? record.priority ?? 10 : ''} onChange={(event) => updateRecord(index, { priority: Number(event.target.value) })} className={inputClass} placeholder="Priority" disabled={record.type !== 'MX'} />
                            <button type="button" aria-label="Hapus record" onClick={() => setDraft((current) => ({ ...current, dnsRecords: current.dnsRecords.filter((_, recordIndex) => recordIndex !== index) }))} className="rounded-lg border border-red-500/30 px-3 text-red-500 hover:bg-red-500/10">Hapus</button>
                        </div>
                    ))}
                </div>

                <label className="mt-5 block space-y-1.5 text-sm text-fg-secondary">
                    Catatan Admin
                    <textarea value={draft.adminNote} onChange={(event) => setDraft((current) => ({ ...current, adminNote: event.target.value }))} className={`${inputClass} min-h-24 resize-y`} maxLength={2000} placeholder="Instruksi atau alasan penolakan/kegagalan" />
                </label>

                {error ? <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-danger">{error}</div> : null}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    {row.status === 'pending_admin' ? <button type="button" onClick={() => setDraft((current) => ({ ...current, status: 'dns_pending' }))} className="rounded-xl border border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-500/10">Siapkan DNS</button> : null}
                    {row.status === 'dns_detected' ? <button type="button" onClick={() => setDraft((current) => ({ ...current, status: 'verified' }))} className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/10">Tandai Verified</button> : null}
                    <button type="submit" disabled={saving} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:opacity-85 disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan Perubahan'}</button>
                </div>
            </form>
        </AdminModal>
    );
}

export function ClientDeskEmailDomainsPanel() {
    const [domains, setDomains] = useState<EmailDomainRow[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | DomainStatus>('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [editing, setEditing] = useState<EmailDomainRow | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const requestRef = useRef<AbortController | null>(null);

    const fetchDomains = useCallback(async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize), q: debouncedSearch });
            if (statusFilter !== 'all') query.set('status', statusFilter);
            const response = await fetch(`/api/admin/clientdesk-email-domains?${query}`, { cache: 'no-store', signal: controller.signal });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                setError(payload?.error || 'Gagal memuat pengajuan domain email.');
                return;
            }
            const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.domains) ? payload.domains : [];
            setDomains(rows.map((row: EmailDomainRow) => ({
                ...row,
                dns_records: Array.isArray(row.dns_records)
                    ? row.dns_records.map((record) => normalizeClientDeskDnsRecord(record)).filter((record: DnsRecord | null): record is DnsRecord => Boolean(record))
                    : [],
            })));
            if (payload?.pagination) setPagination(payload.pagination);
        } catch (caught) {
            if (caught instanceof DOMException && caught.name === 'AbortError') return;
            setError('Tidak dapat terhubung ke ClientDesk.');
        } finally {
            if (requestRef.current === controller) setLoading(false);
        }
    }, [debouncedSearch, pagination.page, pagination.pageSize, statusFilter]);

    useEffect(() => { void fetchDomains(); }, [fetchDomains]);
    useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
    useEffect(() => { setPagination((current) => ({ ...current, page: 1 })); }, [debouncedSearch, statusFilter]);
    useEffect(() => {
        if (editOpen || !editing) return;
        const timer = window.setTimeout(() => setEditing(null), 220);
        return () => window.clearTimeout(timer);
    }, [editOpen, editing]);

    const visibleDomains = domains;

    async function saveDomain(draft: DomainDraft) {
        if (!editing) return;
        const validated = validateClientDeskEmailDomainDraft(draft, editing.domain);
        if (!validated.ok) {
            setError(validated.error);
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await fetch('/api/admin/clientdesk-email-domains', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: editing.user_id,
                    ...validated.data,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                setError(payload?.error || 'Gagal menyimpan domain email.');
                return;
            }
            setEditOpen(false);
            setNotice(`Domain ${editing.domain} berhasil diperbarui.`);
            await fetchDomains();
        } catch {
            setError('Tidak dapat terhubung ke ClientDesk.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-card p-5 shadow-[var(--shadow)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div><h3 className="text-base font-semibold text-fg">Domain Pengirim Email</h3><p className="mt-1 text-sm text-fg-muted">Proses pengajuan ClientDesk melalui dashboard Sumopod, lalu kembalikan DNS dan status verifikasinya.</p></div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="Cari studio atau domain…" />
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | DomainStatus)} className={inputClass}>
                            <option value="all">Semua status</option>
                            {DOMAIN_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                        </select>
                        <button type="button" onClick={() => void fetchDomains()} disabled={loading} className="whitespace-nowrap rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-fg hover:bg-bg-secondary disabled:opacity-50">{loading ? 'Memuat…' : 'Refresh'}</button>
                    </div>
                </div>
            </div>

            {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600">{notice}</div> : null}
            {error && !editing ? <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-danger">{error}</div> : null}

            <div className="flex items-center justify-between text-sm text-fg-muted"><span>{pagination.total} pengajuan</span><span>ClientDesk adalah sumber data utama</span></div>

            {!loading && visibleDomains.length === 0 ? (
                <div className="rounded-xl border border-border bg-bg-card py-14 text-center text-sm text-fg-muted">Belum ada pengajuan domain untuk filter ini.</div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-bg-card shadow-[var(--shadow)]">
                    <table className="w-full min-w-[980px]">
                        <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted"><tr><th className="px-4 py-3">Studio / Domain</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider ID</th><th className="px-4 py-3">DNS</th><th className="px-4 py-3">Diajukan</th><th className="px-4 py-3">Verified</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                        <tbody className="divide-y divide-border-light">{loading ? Array.from({ length: 8 }).map((_, index) => (
                            <tr key={index}>{Array.from({ length: 7 }).map((__, cell) => <td key={cell} className="px-4 py-3"><div className="skeleton h-4 w-full max-w-32" /></td>)}</tr>
                        )) : visibleDomains.map((row) => (
                            <tr key={row.user_id} className="text-sm text-fg hover:bg-bg-secondary/50">
                                <td className="px-4 py-3"><p className="font-semibold">{studioName(row)}</p><p className="text-xs text-fg-muted">{row.domain}</p></td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                                <td className="px-4 py-3 font-mono text-xs text-fg-secondary">{row.provider_domain_id || '—'}</td>
                                <td className="px-4 py-3">{row.dns_records.length} record</td>
                                <td className="px-4 py-3 text-xs text-fg-secondary">{formatDate(row.submitted_at)}</td>
                                <td className="px-4 py-3 text-xs text-fg-secondary">{formatDate(row.verified_at)}</td>
                                <td className="px-4 py-3 text-right"><button type="button" onClick={() => { setError(''); setNotice(''); setEditing(row); setEditOpen(true); }} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:opacity-85">Proses</button></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
            <Pagination meta={pagination} loading={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize: PageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />

            {editing ? <EditDialog open={editOpen} row={editing} saving={saving} error={error} onClose={() => !saving && setEditOpen(false)} onSave={(draft) => void saveDomain(draft)} /> : null}
        </div>
    );
}
