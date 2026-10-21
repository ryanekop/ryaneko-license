'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminModal } from '@/components/AdminModal';
import { AdminToast } from '@/components/AdminToast';
import { Pagination } from '@/components/Pagination';
import { ProductSubnavIcons } from '@/components/ProductSubnav';
import { DEFAULT_PAGE_SIZE, type PaginationMeta } from '@/lib/pagination';
import { useLang } from '@/lib/providers';
import type { FastpikBlockedEmail } from '@/lib/fastpik-blocklist';

const copy = {
    id: {
        add: 'Tambah Email Diblokir', reason: 'Alasan internal (opsional)', block: 'Blokir', search: 'Cari email atau alasan...',
        refresh: 'Refresh', status: 'Status', account: 'ID Akun Terkait', reasonHeading: 'Alasan internal', updated: 'Diperbarui', actions: 'Aksi',
        active: 'Aktif', disabled: 'Nonaktif', enable: 'Aktifkan', disable: 'Nonaktifkan', remove: 'Hapus',
        empty: 'Belum ada email dalam blocklist.', noResults: 'Tidak ada email yang cocok.', loadError: 'Gagal memuat blocklist Fastpik.',
        actionError: 'Gagal menyimpan perubahan.', saved: 'Blocklist diperbarui.', cancel: 'Batal',
        deleteTitle: 'Hapus aturan blokir?', deleteDetail: 'Aturan blokir akan dihapus. Akun dan proyek tetap tersimpan.',
        hint: 'Blokir berlaku untuk akses pemilik akun. Galeri klien tetap aktif.',
    },
    en: {
        add: 'Add Blocked Email', reason: 'Internal reason (optional)', block: 'Block', search: 'Search email or reason...',
        refresh: 'Refresh', status: 'Status', account: 'Linked User ID', reasonHeading: 'Internal reason', updated: 'Updated', actions: 'Actions',
        active: 'Active', disabled: 'Disabled', enable: 'Enable', disable: 'Disable', remove: 'Delete',
        empty: 'No blocked emails yet.', noResults: 'No matching emails.', loadError: 'Failed to load the Fastpik blocklist.',
        actionError: 'Failed to save changes.', saved: 'Blocklist updated.', cancel: 'Cancel',
        deleteTitle: 'Delete blocklist rule?', deleteDetail: 'This removes the blocklist rule. The account and projects are retained.',
        hint: 'Blocking restricts the account owner. Client galleries remain active.',
    },
};

export function FastpikBlocklistPanel() {
    const { lang } = useLang();
    const text = copy[lang];
    const [items, setItems] = useState<FastpikBlockedEmail[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<FastpikBlockedEmail | null>(null);
    const requestRef = useRef<AbortController | null>(null);

    const load = useCallback(async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize), q: query });
            const response = await fetch(`/api/admin/fastpik-blocklist?${params}`, { signal: controller.signal, cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || text.loadError);
            if (controller.signal.aborted) return;
            setItems(data.items);
            setPagination(data.pagination);
        } catch (caught) {
            if (controller.signal.aborted) return;
            setError(caught instanceof Error ? caught.message : text.loadError);
        } finally {
            if (requestRef.current === controller) setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, query, text.loadError]);

    useEffect(() => { void load(); return () => requestRef.current?.abort(); }, [load]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery(search.trim());
            setPagination((current) => current.page === 1 ? current : { ...current, page: 1 });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);
    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const mutate = async (method: 'POST' | 'PUT' | 'DELETE', body: object) => {
        setPending(true);
        setError('');
        try {
            const response = await fetch('/api/admin/fastpik-blocklist', {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || text.actionError);
            if (method === 'POST') { setEmail(''); setReason(''); }
            setDeleteEntry(null);
            setToast({ success: true, message: text.saved });
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : text.actionError);
        } finally {
            setPending(false);
        }
    };

    const add = (event: FormEvent) => {
        event.preventDefault();
        void mutate('POST', { email, reason });
    };

    return (
        <div className="space-y-4">
            <AdminToast toast={toast} />
            <form onSubmit={add} className="bg-bg-card rounded-xl border border-border p-5 shadow-[var(--shadow)]">
                <h3 className="text-sm font-semibold text-fg mb-2 flex items-center gap-2">{ProductSubnavIcons.blocklist} {text.add}</h3>
                <p className="text-sm text-fg-secondary mb-4">{text.hint}</p>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3">
                    <input type="email" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" required maxLength={254} disabled={pending}
                        className="min-w-0 px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50" />
                    <input aria-label={text.reason} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={text.reason} maxLength={2000} disabled={pending}
                        className="min-w-0 px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50" />
                    <button type="submit" disabled={pending} className="px-4 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-semibold cursor-pointer hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2">
                        {ProductSubnavIcons.blocklist} {text.block}
                    </button>
                </div>
            </form>

            <div className="flex flex-wrap gap-3">
                <input aria-label={text.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search}
                    className="min-w-0 flex-1 px-3 py-2.5 bg-bg-card border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20" />
                <button type="button" onClick={() => void load()} disabled={loading || pending} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary disabled:opacity-50">{text.refresh}</button>
            </div>
            {error && <div role="alert" className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3">{error}</div>}
            <div className="flex items-center gap-2 text-fg-secondary text-sm">{ProductSubnavIcons.blocklist} Blocklist: <span className="font-semibold text-fg">{pagination.total}</span></div>
            {!loading && items.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">{query ? text.noResults : text.empty}</div>
            ) : (
                <div className="overflow-auto max-h-[calc(100vh-360px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)]" aria-busy={loading}>
                    <table className="w-full">
                        <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                            <tr className="text-left text-fg text-xs uppercase tracking-wider">
                                {['Email', text.status, text.account, text.reasonHeading, text.updated, text.actions].map((heading) => <th key={heading} className="px-4 py-3 font-medium whitespace-nowrap">{heading}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light">
                            {loading ? Array.from({ length: 5 }, (_, row) => <tr key={row}>{Array.from({ length: 6 }, (_, cell) => <td key={cell} className="px-4 py-3"><div className="skeleton h-4 w-24" /></td>)}</tr>) : items.map((entry) => (
                                <tr key={entry.id} className="text-fg hover:bg-bg-secondary/50">
                                    <td className="px-4 py-2.5 text-sm font-medium">{entry.email}</td>
                                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${entry.is_active ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{entry.is_active ? text.active : text.disabled}</span></td>
                                    <td className="px-4 py-2.5 text-xs font-mono text-fg-secondary">{entry.suspended_user_id || '—'}</td>
                                    <td className="px-4 py-2.5 text-sm text-fg-secondary max-w-[240px] truncate" title={entry.reason || ''}>{entry.reason || '—'}</td>
                                    <td className="px-4 py-2.5 text-sm whitespace-nowrap">{new Date(entry.updated_at).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</td>
                                    <td className="px-4 py-2.5"><div className="flex justify-end gap-1.5">
                                        <button type="button" onClick={() => void mutate('PUT', { id: entry.id, is_active: !entry.is_active })} disabled={pending || loading} className={`px-2.5 py-1.5 text-white rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50 ${entry.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{entry.is_active ? text.disable : text.enable}</button>
                                        <button type="button" onClick={() => setDeleteEntry(entry)} disabled={pending || loading} className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-red-600 disabled:opacity-50">{text.remove}</button>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination meta={pagination} loading={loading || pending}
                onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
                onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />

            <AdminModal open={Boolean(deleteEntry)} onClose={() => setDeleteEntry(null)} closeDisabled={pending}>
                <h3 className="text-lg font-semibold text-fg">{text.deleteTitle}</h3>
                <p className="text-sm text-fg-secondary mt-2 break-all">{deleteEntry?.email}</p>
                <p className="text-sm text-fg-muted mt-2">{text.deleteDetail}</p>
                {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
                <div className="flex justify-end gap-2 mt-5">
                    <button type="button" disabled={pending} onClick={() => setDeleteEntry(null)} className="px-4 py-2 bg-bg-secondary text-fg rounded-lg text-sm cursor-pointer disabled:opacity-50">{text.cancel}</button>
                    <button type="button" disabled={pending} onClick={() => deleteEntry && void mutate('DELETE', { id: deleteEntry.id })} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm cursor-pointer disabled:opacity-50">{text.remove}</button>
                </div>
            </AdminModal>
        </div>
    );
}
