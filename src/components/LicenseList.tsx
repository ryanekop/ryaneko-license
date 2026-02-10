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
    productEmoji?: string;
}

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

export default function LicenseList({ productSlug, productName, productEmoji = '📦' }: LicenseListProps) {
    const { t } = useLang();
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

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
    }, [productSlug, page, search, statusFilter]);

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
                        {t('list.statusAvailable').replace('🟢 ', '')}
                    </span>
                );
            case 'used':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-fg-muted/10 text-fg-secondary border border-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                        {t('list.statusUsed').replace('⚪ ', '')}
                    </span>
                );
            case 'revoked':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                        {t('list.statusRevoked').replace('🔴 ', '')}
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
                <div>
                    <h2 className="text-2xl font-bold text-fg flex items-center gap-2">
                        <span>{productEmoji}</span> {productName}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-fg-muted">
                        <span>📊 {t('list.total')}: <b className="text-fg">{total}</b></span>
                        <span>🟢 {t('list.available')}: <b className="text-success">{availableCount}</b></span>
                        <span>⚪ {t('list.used')}: <b className="text-fg-secondary">{usedCount}</b></span>
                    </div>
                </div>
                <button
                    onClick={fetchLicenses}
                    className="px-4 py-2 bg-bg-card border border-border rounded-lg text-fg-secondary text-sm hover:bg-bg-secondary hover:text-fg hover:border-fg-muted transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[var(--shadow)]"
                >
                    🔄 {t('list.refresh')}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder={t('list.search')}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 text-sm transition-all"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm cursor-pointer transition-all"
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
                            <th className="px-4 py-3 font-medium">{t('list.serial')}</th>
                            <th className="px-4 py-3 font-medium">{t('list.status')}</th>
                            <th className="px-4 py-3 font-medium">{t('list.name')}</th>
                            <th className="px-4 py-3 font-medium">{t('list.email')}</th>
                            <th className="px-4 py-3 font-medium">{t('list.device')}</th>
                            <th className="px-4 py-3 font-medium">{t('list.activated')}</th>
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
                                    <td className="px-4 py-3"><div className="skeleton h-7 w-32 ml-auto" /></td>
                                </tr>
                            ))
                        ) : licenses.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-16 text-center text-fg-muted animate-fade-in">
                                    <div className="text-4xl mb-2">📭</div>
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
                                    <td className="px-4 py-3 text-sm">{license.customer_name || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 text-fg-secondary text-sm">
                                        {license.customer_email || <span className="text-fg-muted">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{license.device_type || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {formatDate(license.activated_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setChangeDialog(license); setNewPlatform(license.device_type || ''); }}
                                                className="px-2.5 py-1.5 text-xs bg-warning/10 text-warning border border-warning/20 rounded-lg hover:bg-warning/20 hover:border-warning/40 hover:shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                            >
                                                ✏️ {t('action.change')}
                                            </button>
                                            <button
                                                onClick={() => setResetDialog(license)}
                                                className="px-2.5 py-1.5 text-xs bg-fg-muted/10 text-fg-secondary border border-border rounded-lg hover:bg-fg-muted/20 hover:border-fg-muted/40 hover:shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                            >
                                                🔄 {t('action.reset')}
                                            </button>
                                            <button
                                                onClick={() => setDeleteDialog(license)}
                                                className="px-2.5 py-1.5 text-xs bg-danger/10 text-danger border border-danger/20 rounded-lg hover:bg-danger/20 hover:border-danger/40 hover:shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                            >
                                                🗑️ {t('action.delete')}
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
                        className="px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 hover:bg-bg-secondary hover:scale-105 active:scale-95 transition-all"
                    >
                        {t('list.previous')}
                    </button>
                    <span className="px-3 py-2 text-fg-muted text-sm">
                        {t('list.page')} {page} {t('list.of')} {Math.ceil(total / 50)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 50)}
                        className="px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 hover:bg-bg-secondary hover:scale-105 active:scale-95 transition-all"
                    >
                        {t('list.next')}
                    </button>
                </div>
            )}

            {/* ===== DIALOGS ===== */}

            {/* Change Device Dialog */}
            <Dialog open={!!changeDialog} onClose={() => { setChangeDialog(null); setNewPlatform(''); }}>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-fg flex items-center gap-2">
                            ✏️ {t('dialog.changeTitle')}
                        </h3>
                        <p className="text-fg-muted text-sm mt-1">{t('dialog.changeDesc')}</p>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{changeDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{changeDialog?.customer_name || '-'}</span></div>
                    </div>

                    <select
                        value={newPlatform}
                        onChange={(e) => setNewPlatform(e.target.value)}
                        className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm cursor-pointer"
                    >
                        <option value="">{t('dialog.selectPlatform')}</option>
                        <option value="Mac">🍎 Mac</option>
                        <option value="Windows">🪟 Windows</option>
                        <option value="Mac (Monterey)">🍎 Mac (Monterey)</option>
                        <option value="Mac (Ventura)">🍎 Mac (Ventura)</option>
                        <option value="Mac (Sonoma)">🍎 Mac (Sonoma)</option>
                        <option value="Mac (Sequoia)">🍎 Mac (Sequoia)</option>
                    </select>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => { setChangeDialog(null); setNewPlatform(''); }}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl hover:bg-border transition-all hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleChangeDevice}
                            disabled={!newPlatform || actionLoading}
                            className="flex-1 py-2.5 bg-warning text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] text-sm font-medium flex items-center justify-center gap-2"
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
                    <div>
                        <h3 className="text-lg font-semibold text-fg flex items-center gap-2">
                            🔄 {t('dialog.resetTitle')}
                        </h3>
                        <p className="text-fg-muted text-sm mt-1">{t('dialog.resetDesc')}</p>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{resetDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{resetDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setResetDialog(null)}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl hover:bg-border transition-all hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={actionLoading}
                            className="flex-1 py-2.5 bg-accent text-accent-fg rounded-xl hover:opacity-90 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] text-sm font-medium flex items-center justify-center gap-2"
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
                    <div>
                        <h3 className="text-lg font-semibold text-danger flex items-center gap-2">
                            🗑️ {t('dialog.deleteTitle')}
                        </h3>
                        <p className="text-fg-muted text-sm mt-1">{t('dialog.deleteDesc')}</p>
                    </div>

                    <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono">{deleteDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{deleteDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setDeleteDialog(null)}
                            className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl hover:bg-border transition-all hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="flex-1 py-2.5 bg-danger text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] text-sm font-medium flex items-center justify-center gap-2"
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
