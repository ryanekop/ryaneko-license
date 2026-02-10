'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/lib/providers';

interface Product {
    id: string;
    name: string;
    slug: string;
}

interface License {
    id: string;
    serial_key: string;
    status: 'available' | 'used' | 'revoked';
    customer_name?: string;
    customer_email?: string;
    device_type?: string;
    device_id?: string;
    activated_at?: string;
    last_active_at?: string;
    created_at: string;
    product?: Product;
}

interface LicenseListProps {
    productSlug: string;
    productName: string;
    productIcon?: React.ReactNode;
}

// --- SVG ICONS ---
const Icons = {
    search: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
    ),
    refresh: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
        </svg>
    ),
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
    ),
    reset: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
        </svg>
    ),
    trash: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    ),
    sortAsc: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8 4-4 4 4" /><path d="M7 4v16" /><path d="M11 12h4" /><path d="M11 16h7" /><path d="M11 20h10" />
        </svg>
    ),
    sortDesc: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="M11 4h10" /><path d="M11 8h7" /><path d="M11 12h4" />
        </svg>
    ),
    key: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
        </svg>
    ),
    user: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    mail: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    ),
    monitor: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
        </svg>
    ),
    calendar: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
        </svg>
    ),
    warning: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
        </svg>
    ),
    inbox: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
    ),
    chart: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" />
        </svg>
    ),
};

// --- DIALOG COMPONENT ---
function Dialog({
    open,
    onClose,
    children,
}: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    if (!open) return null;
    return (
        <>
            <div className="dialog-overlay" onClick={onClose} />
            <div className="dialog-content">
                <div className="bg-bg-card rounded-2xl border border-border shadow-[var(--shadow-lg)] p-6">
                    {children}
                </div>
            </div>
        </>
    );
}

export default function LicenseList({ productSlug, productName, productIcon }: LicenseListProps) {
    const { t } = useLang();
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortAsc, setSortAsc] = useState(false);

    // Dialog states
    const [changeDialog, setChangeDialog] = useState<License | null>(null);
    const [resetDialog, setResetDialog] = useState<License | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<License | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [newPlatform, setNewPlatform] = useState('');

    const fetchLicenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                product: productSlug,
                page: page.toString(),
                limit: '50',
                status: statusFilter,
                sort: sortAsc ? 'asc' : 'desc',
                ...(search && { search }),
            });

            const res = await fetch(`/api/admin/licenses?${params}`);
            const data = await res.json();

            setLicenses(data.licenses || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch licenses:', error);
        } finally {
            setLoading(false);
        }
    }, [productSlug, page, search, statusFilter, sortAsc]);

    useEffect(() => {
        fetchLicenses();
    }, [fetchLicenses]);

    // --- ACTIONS ---
    const handleChangeDevice = async () => {
        if (!changeDialog || !newPlatform) return;
        setActionLoading(true);
        try {
            await fetch('/api/admin/licenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: changeDialog.id, device_type: newPlatform }),
            });
            setChangeDialog(null);
            setNewPlatform('');
            fetchLicenses();
        } finally {
            setActionLoading(false);
        }
    };

    const handleReset = async () => {
        if (!resetDialog) return;
        setActionLoading(true);
        try {
            await fetch('/api/admin/licenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: resetDialog.id, action: 'reset' }),
            });
            setResetDialog(null);
            fetchLicenses();
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog) return;
        setActionLoading(true);
        try {
            await fetch(`/api/admin/licenses?id=${deleteDialog.id}`, {
                method: 'DELETE',
            });
            setDeleteDialog(null);
            fetchLicenses();
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        {t('list.statusAvailable').replace(/[^\w\s]/g, '').trim()}
                    </span>
                );
            case 'used':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-fg-muted/10 text-fg-secondary border border-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                        {t('list.statusUsed').replace(/[^\w\s]/g, '').trim()}
                    </span>
                );
            case 'revoked':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                        {t('list.statusRevoked').replace(/[^\w\s]/g, '').trim()}
                    </span>
                );
            default:
                return null;
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const availableCount = licenses.filter(l => l.status === 'available').length;
    const usedCount = licenses.filter(l => l.status === 'used').length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
                <div>
                    <h2 className="text-2xl font-bold text-fg flex items-center gap-2.5">
                        {productIcon} {productName}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-fg-muted">
                        <span className="flex items-center gap-1.5">{Icons.chart} {t('list.total')}: <b className="text-fg">{total}</b></span>
                        <span>{t('list.available')}: <b className="text-success">{availableCount}</b></span>
                        <span>{t('list.used')}: <b className="text-fg-secondary">{usedCount}</b></span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setSortAsc(!sortAsc); setPage(1); }}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-fg-secondary text-sm cursor-pointer hover:bg-bg-secondary hover:text-fg hover:border-fg-muted transition-all active:scale-95 flex items-center gap-1.5 shadow-[var(--shadow)]"
                        title={sortAsc ? 'Oldest first' : 'Newest first'}
                    >
                        {sortAsc ? Icons.sortAsc : Icons.sortDesc}
                        <span className="hidden sm:inline">{sortAsc ? (t('list.sortOldest') || 'Terlama') : (t('list.sortNewest') || 'Terbaru')}</span>
                    </button>
                    <button
                        onClick={fetchLicenses}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-fg-secondary text-sm cursor-pointer hover:bg-bg-secondary hover:text-fg hover:border-fg-muted transition-all active:scale-95 flex items-center gap-1.5 shadow-[var(--shadow)]"
                    >
                        {Icons.refresh} {t('list.refresh')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">{Icons.search}</span>
                    <input
                        type="text"
                        placeholder={t('list.search')}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 text-sm transition-all cursor-text"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm cursor-pointer transition-all hover:bg-bg-secondary"
                >
                    <option value="all">{t('list.allStatus')}</option>
                    <option value="available">{t('list.statusAvailable')}</option>
                    <option value="used">{t('list.statusUsed')}</option>
                    <option value="revoked">{t('list.statusRevoked')}</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-bg-card rounded-xl border border-border shadow-[var(--shadow)] animate-slide-up stagger-1" style={{ opacity: 0 }}>
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-fg-muted text-xs uppercase tracking-wider border-b border-border">
                            <th className="px-4 py-3 font-medium">No.</th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.key} {t('list.serial').replace(/[^\w\s]/g, '').trim()}</span></th>
                            <th className="px-4 py-3 font-medium">{t('list.status')}</th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.user} {t('list.name').replace(/[^\w\s]/g, '').trim()}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.mail} {t('list.email').replace(/[^\w\s]/g, '').trim()}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.monitor} {t('list.device').replace(/[^\w\s]/g, '').trim()}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.calendar} {t('list.activated').replace(/[^\w\s]/g, '').trim()}</span></th>
                            <th className="px-4 py-3 font-medium text-right">{t('list.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="table-row" style={{ animationDelay: `${i * 0.05}s` }}>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-6" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-36" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-28" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-36" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-16" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-20" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-8 w-36 ml-auto" /></td>
                                </tr>
                            ))
                        ) : licenses.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-16 text-center text-fg-muted animate-fade-in">
                                    <div className="flex justify-center mb-3 opacity-40">{Icons.inbox}</div>
                                    {t('list.empty')}
                                </td>
                            </tr>
                        ) : (
                            licenses.map((license, index) => (
                                <tr
                                    key={license.id}
                                    className="table-row text-fg hover:bg-bg-secondary/50 transition-colors"
                                    style={{ animationDelay: `${index * 0.03}s` }}
                                >
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {(page - 1) * 50 + index + 1}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-sm text-fg-secondary">
                                        {license.serial_key}
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(license.status)}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{license.customer_name || <span className="text-fg-muted font-normal">-</span>}</td>
                                    <td className="px-4 py-3 text-fg-secondary text-sm">
                                        {license.customer_email || <span className="text-fg-muted">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{license.device_type || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {formatDate(license.activated_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {/* UBAH - bold warning button */}
                                            <button
                                                onClick={() => { setChangeDialog(license); setNewPlatform(license.device_type || ''); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-warning text-white rounded-lg cursor-pointer hover:bg-amber-600 hover:shadow-md transition-all active:scale-95"
                                            >
                                                {Icons.edit} {t('action.change')}
                                            </button>
                                            {/* RESET - bold neutral button */}
                                            <button
                                                onClick={() => setResetDialog(license)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-fg-muted/20 text-fg-secondary border border-border rounded-lg cursor-pointer hover:bg-fg-muted/30 hover:text-fg hover:shadow-md transition-all active:scale-95"
                                            >
                                                {Icons.reset} {t('action.reset')}
                                            </button>
                                            {/* HAPUS - bold red button */}
                                            <button
                                                onClick={() => setDeleteDialog(license)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-danger text-white rounded-lg cursor-pointer hover:bg-red-600 hover:shadow-md transition-all active:scale-95"
                                            >
                                                {Icons.trash}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 50 && (
                <div className="flex items-center justify-center gap-3 animate-fade-in">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 cursor-pointer hover:bg-bg-secondary active:scale-95 transition-all"
                    >
                        {t('list.previous')}
                    </button>
                    <span className="px-3 py-2 text-fg-muted text-sm">
                        {t('list.page')} {page} {t('list.of')} {Math.ceil(total / 50)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 50)}
                        className="px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 cursor-pointer hover:bg-bg-secondary active:scale-95 transition-all"
                    >
                        {t('list.next')}
                    </button>
                </div>
            )}

            {/* ===== DIALOGS ===== */}

            {/* Change Device Dialog */}
            <Dialog open={!!changeDialog} onClose={() => { setChangeDialog(null); setNewPlatform(''); }}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-warning/10 text-warning rounded-lg">{Icons.edit}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-fg">{t('dialog.changeTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.changeDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{changeDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{changeDialog?.customer_name || '-'}</span></div>
                    </div>

                    <select
                        value={newPlatform}
                        onChange={(e) => setNewPlatform(e.target.value)}
                        className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm cursor-pointer hover:bg-bg-secondary transition-all"
                    >
                        <option value="">{t('dialog.selectPlatform')}</option>
                        <option value="Mac">Mac</option>
                        <option value="Windows">Windows</option>
                        <option value="Mac (Monterey)">Mac (Monterey)</option>
                        <option value="Mac (Ventura)">Mac (Ventura)</option>
                        <option value="Mac (Sonoma)">Mac (Sonoma)</option>
                        <option value="Mac (Sequoia)">Mac (Sequoia)</option>
                    </select>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => { setChangeDialog(null); setNewPlatform(''); }}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleChangeDevice}
                            disabled={!newPlatform || actionLoading}
                            className="flex-1 py-2.5 bg-warning text-white rounded-xl cursor-pointer hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2"
                        >
                            {actionLoading ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('dialog.processing')}
                                </>
                            ) : (
                                t('dialog.confirm')
                            )}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Reset Dialog */}
            <Dialog open={!!resetDialog} onClose={() => setResetDialog(null)}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-fg-muted/10 text-fg-secondary rounded-lg">{Icons.reset}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-fg">{t('dialog.resetTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.resetDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{resetDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{resetDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setResetDialog(null)}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={actionLoading}
                            className="flex-1 py-2.5 bg-accent text-accent-fg rounded-xl cursor-pointer hover:opacity-85 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2"
                        >
                            {actionLoading ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                                    {t('dialog.processing')}
                                </>
                            ) : (
                                t('dialog.confirm')
                            )}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-danger/10 text-danger rounded-lg">{Icons.warning}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-danger">{t('dialog.deleteTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.deleteDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{deleteDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{deleteDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setDeleteDialog(null)}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="flex-1 py-2.5 bg-danger text-white rounded-xl cursor-pointer hover:bg-red-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2"
                        >
                            {actionLoading ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('dialog.processing')}
                                </>
                            ) : (
                                <>{t('action.delete')}</>
                            )}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
