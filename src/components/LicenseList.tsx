'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    platforms?: { value: string; label: string }[];
}

const DEFAULT_PLATFORMS = [
    { value: 'Mac', label: 'Mac' },
    { value: 'Windows', label: 'Windows' },
];

// --- SVG ICONS ---
const Icons = {
    search: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    ),
    refresh: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
    ),
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
    ),
    editTable: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" /></svg>
    ),
    reset: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
    ),
    trash: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
    ),
    sortAsc: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /><path d="M11 12h4" /><path d="M11 16h7" /><path d="M11 20h10" /></svg>
    ),
    sortDesc: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="M11 4h10" /><path d="M11 8h7" /><path d="M11 12h4" /></svg>
    ),
    key: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></svg>
    ),
    user: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    ),
    mail: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
    ),
    monitor: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>
    ),
    fingerprint: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" /></svg>
    ),
    calendar: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
    ),
    warning: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
    ),
    inbox: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
    ),
    chart: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></svg>
    ),
    eye: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
    ),
    eyeOff: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></svg>
    ),
    chevronLeft: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
    ),
    chevronRight: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    ),
};

// --- PORTAL DIALOG COMPONENT ---
function Dialog({
    open,
    onClose,
    children,
}: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!open || !mounted) return null;

    return createPortal(
        <>
            <div className="dialog-overlay" onClick={onClose} />
            <div className="dialog-content">
                <div className="bg-bg-card rounded-2xl border border-border shadow-[var(--shadow-lg)] p-5 sm:p-6">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
}

export default function LicenseList({ productSlug, productName, productIcon, platforms = DEFAULT_PLATFORMS }: LicenseListProps) {
    const { t } = useLang();
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalAll, setTotalAll] = useState(0);
    const [availableCount, setAvailableCount] = useState(0);
    const [usedCount, setUsedCount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortAsc, setSortAsc] = useState(false);
    const [showEmpty, setShowEmpty] = useState(false);

    const [changeDialog, setChangeDialog] = useState<License | null>(null);
    const [resetDialog, setResetDialog] = useState<License | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<License | null>(null);
    const [editTableDialog, setEditTableDialog] = useState<License | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [newPlatform, setNewPlatform] = useState('');
    const [editSerial, setEditSerial] = useState('');
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editDeviceId, setEditDeviceId] = useState('');

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
                ...(!showEmpty && { hideEmpty: 'true' }),
            });

            const res = await fetch(`/api/admin/licenses?${params}`);
            const data = await res.json();

            setLicenses(data.licenses || []);
            setTotal(data.total || 0);
            setTotalAll(data.totalAll || 0);
            setAvailableCount(data.availableCount || 0);
            setUsedCount(data.usedCount || 0);
        } catch (error) {
            console.error('Failed to fetch licenses:', error);
        } finally {
            setLoading(false);
        }
    }, [productSlug, page, search, statusFilter, sortAsc, showEmpty]);

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

    const handleEditTable = async () => {
        if (!editTableDialog) return;
        setActionLoading(true);
        try {
            await fetch('/api/admin/licenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editTableDialog.id,
                    serial_key: editSerial,
                    customer_name: editName || null,
                    customer_email: editEmail || null,
                    device_id: editDeviceId || null,
                }),
            });
            setEditTableDialog(null);
            fetchLicenses();
        } finally {
            setActionLoading(false);
        }
    };

    const openEditTable = (license: License) => {
        setEditTableDialog(license);
        setEditSerial(license.serial_key);
        setEditName(license.customer_name || '');
        setEditEmail(license.customer_email || '');
        setEditDeviceId(license.device_id || '');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {t('list.statusAvailable')}
                    </span>
                );
            case 'used':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {t('list.statusUsed')}
                    </span>
                );
            case 'revoked':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {t('list.statusRevoked')}
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

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                            {productIcon} {productName}
                        </h2>
                        <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-fg-muted">
                            <span className="flex items-center gap-1.5">{Icons.chart} {t('list.total')}: <b className="text-fg">{totalAll}</b></span>
                            <span>{t('list.available')}: <b className="text-emerald-600">{availableCount}</b></span>
                            <span>{t('list.used')}: <b className="text-amber-600">{usedCount}</b></span>
                        </div>
                    </div>
                    {/* Action buttons row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => { setShowEmpty(!showEmpty); setPage(1); }}
                            className={`px-3 py-2 border rounded-lg text-xs sm:text-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shadow-[var(--shadow)] font-medium ${showEmpty
                                ? 'bg-bg-card border-border text-fg-secondary hover:bg-bg-secondary hover:text-fg'
                                : 'bg-accent text-accent-fg border-accent'
                                }`}
                            title={showEmpty ? 'Hide empty serials' : 'Show empty serials'}
                        >
                            {showEmpty ? Icons.eye : Icons.eyeOff}
                            <span className="hidden sm:inline">{showEmpty ? (t('list.showEmpty') || 'Serial Kosong') : (t('list.hideEmpty') || 'Sembunyikan')}</span>
                        </button>
                        <button
                            onClick={() => { setSortAsc(!sortAsc); setPage(1); }}
                            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-fg-secondary text-xs sm:text-sm cursor-pointer hover:bg-bg-secondary hover:text-fg hover:border-fg-muted transition-all active:scale-95 flex items-center gap-1.5 shadow-[var(--shadow)] font-medium"
                        >
                            {sortAsc ? Icons.sortAsc : Icons.sortDesc}
                            <span className="hidden sm:inline">{sortAsc ? t('list.sortOldest') : t('list.sortNewest')}</span>
                        </button>
                        <button
                            onClick={fetchLicenses}
                            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-fg-secondary text-xs sm:text-sm cursor-pointer hover:bg-bg-secondary hover:text-fg hover:border-fg-muted transition-all active:scale-95 flex items-center gap-1.5 shadow-[var(--shadow)] font-medium"
                        >
                            {Icons.refresh} <span className="hidden sm:inline">{t('list.refresh')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 animate-slide-up">
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

            {/* === DESKTOP TABLE === */}
            <div className="hidden md:block overflow-auto max-h-[calc(100vh-280px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)] animate-slide-up stagger-1" style={{ opacity: 0 }}>
                <table className="w-full min-w-[1200px]">
                    <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                        <tr className="text-left text-fg-muted text-xs uppercase tracking-wider whitespace-nowrap">
                            <th className="px-4 py-3 font-medium">No.</th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.key} {t('list.serial')}</span></th>
                            <th className="px-4 py-3 font-medium">{t('list.status')}</th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.user} {t('list.name')}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.mail} {t('list.email')}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.monitor} {t('list.device')}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.fingerprint} {t('list.deviceId')}</span></th>
                            <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5">{Icons.calendar} {t('list.activated')}</span></th>
                            <th className="px-4 py-3 font-medium text-right">{t('list.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="row-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-6" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-36" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-6 w-20 rounded-full" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-28" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-36" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-16" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-24" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-4 w-20" /></td>
                                    <td className="px-4 py-3"><div className="skeleton h-8 w-44 ml-auto" /></td>
                                </tr>
                            ))
                        ) : licenses.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-16 text-center text-fg-muted animate-fade-in">
                                    <div className="flex justify-center mb-3 opacity-40">{Icons.inbox}</div>
                                    {t('list.empty')}
                                </td>
                            </tr>
                        ) : (
                            licenses.map((license, index) => (
                                <tr
                                    key={license.id}
                                    className="row-animate text-fg hover:bg-bg-secondary/50 transition-colors"
                                    style={{ animationDelay: `${index * 0.03}s` }}
                                >
                                    <td className="px-4 py-3 text-sm text-fg-muted">{(page - 1) * 50 + index + 1}</td>
                                    <td className="px-4 py-3 font-mono text-sm text-fg-secondary whitespace-nowrap">{license.serial_key}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(license.status)}</td>
                                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{license.customer_name || <span className="text-fg-muted font-normal">-</span>}</td>
                                    <td className="px-4 py-3 text-fg-secondary text-sm whitespace-nowrap">{license.customer_email || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 text-sm whitespace-nowrap">{license.device_type || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-fg-muted max-w-[150px] truncate" title={license.device_id || '-'}>{license.device_id || <span className="text-fg-muted">-</span>}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{formatDate(license.activated_at)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button onClick={() => openEditTable(license)} className="inline-flex items-center justify-center w-8 h-8 bg-indigo-500 text-white rounded-lg cursor-pointer hover:bg-indigo-600 hover:shadow-md transition-all active:scale-95" title={t('action.editTable')}>{Icons.editTable}</button>
                                            <button onClick={() => { setChangeDialog(license); setNewPlatform(license.device_type || ''); }} className="inline-flex items-center justify-center w-8 h-8 bg-warning text-white rounded-lg cursor-pointer hover:bg-amber-600 hover:shadow-md transition-all active:scale-95" title={t('action.editDevice')}>{Icons.edit}</button>
                                            <button onClick={() => setResetDialog(license)} className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 hover:shadow-md transition-all active:scale-95" title={t('action.reset')}>{Icons.reset}</button>
                                            <button onClick={() => setDeleteDialog(license)} className="inline-flex items-center justify-center w-8 h-8 bg-danger text-white rounded-lg cursor-pointer hover:bg-red-600 hover:shadow-md transition-all active:scale-95" title={t('action.delete')}>{Icons.trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* === MOBILE CARDS === */}
            <div className="md:hidden space-y-3 animate-slide-up stagger-1" style={{ opacity: 0 }}>
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-bg-card rounded-xl border border-border p-4 space-y-3" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="skeleton h-4 w-48" />
                            <div className="skeleton h-6 w-24 rounded-full" />
                            <div className="skeleton h-4 w-36" />
                            <div className="skeleton h-8 w-full" />
                        </div>
                    ))
                ) : licenses.length === 0 ? (
                    <div className="bg-bg-card rounded-xl border border-border p-8 text-center text-fg-muted animate-fade-in">
                        <div className="flex justify-center mb-3 opacity-40">{Icons.inbox}</div>
                        {t('list.empty')}
                    </div>
                ) : (
                    licenses.map((license, index) => (
                        <div
                            key={license.id}
                            className="row-animate bg-bg-card rounded-xl border border-border p-4 shadow-[var(--shadow)]"
                            style={{ animationDelay: `${index * 0.04}s` }}
                        >
                            {/* Top: Name/Serial + Status */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0">
                                    <p className="font-semibold text-fg text-sm">{license.customer_name || <span className="text-fg-muted font-normal">—</span>}</p>
                                    <p className="font-mono text-xs text-fg-muted break-all mt-0.5">{license.serial_key}</p>
                                </div>
                                {getStatusBadge(license.status)}
                            </div>

                            {/* Bottom: Info + Actions */}
                            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border-light">
                                <div className="text-xs text-fg space-y-0.5">
                                    {license.customer_email && <p>{license.customer_email}</p>}
                                    <p>{t('list.device')}: {license.device_type || '—'}</p>
                                    {license.device_id && <p className="font-mono text-fg-muted truncate" title={license.device_id}>{t('list.deviceId')}: {license.device_id}</p>}
                                    <p>{t('list.activated')}: {formatDate(license.activated_at)}</p>
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    <button onClick={() => openEditTable(license)} className="flex items-center justify-center w-8 h-8 bg-indigo-500 text-white rounded-lg cursor-pointer hover:bg-indigo-600 transition-all active:scale-95" title={t('action.editTable')}>{Icons.editTable}</button>
                                    <button onClick={() => { setChangeDialog(license); setNewPlatform(license.device_type || ''); }} className="flex items-center justify-center w-8 h-8 bg-warning text-white rounded-lg cursor-pointer hover:bg-amber-600 transition-all active:scale-95" title={t('action.editDevice')}>{Icons.edit}</button>
                                    <button onClick={() => setResetDialog(license)} className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-all active:scale-95" title={t('action.reset')}>{Icons.reset}</button>
                                    <button onClick={() => setDeleteDialog(license)} className="flex items-center justify-center w-8 h-8 bg-danger text-white rounded-lg cursor-pointer hover:bg-red-600 transition-all active:scale-95" title={t('action.delete')}>{Icons.trash}</button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {total > 50 && (
                <div className="flex items-center justify-center gap-3 animate-fade-in">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 sm:px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 cursor-pointer hover:bg-bg-secondary active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        {Icons.chevronLeft} <span className="hidden sm:inline">{t('list.previous')}</span>
                    </button>
                    <span className="px-3 py-2 text-fg-muted text-sm">
                        {page} / {Math.ceil(total / 50)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 50)}
                        className="px-3 sm:px-4 py-2 bg-bg-card border border-border rounded-lg text-fg text-sm disabled:opacity-30 cursor-pointer hover:bg-bg-secondary active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        <span className="hidden sm:inline">{t('list.next')}</span> {Icons.chevronRight}
                    </button>
                </div>
            )}

            {/* ===== PORTAL DIALOGS ===== */}

            {/* Edit Device Dialog (formerly "Change") */}
            <Dialog open={!!changeDialog} onClose={() => { setChangeDialog(null); setNewPlatform(''); }}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-warning/10 text-warning rounded-lg shrink-0">{Icons.edit}</div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-fg">{t('dialog.changeTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.changeDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono text-xs sm:text-sm break-all">{changeDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{changeDialog?.customer_name || '-'}</span></div>
                    </div>

                    <select
                        value={newPlatform}
                        onChange={(e) => setNewPlatform(e.target.value)}
                        className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm cursor-pointer hover:bg-bg-secondary transition-all"
                    >
                        <option value="">{t('dialog.selectPlatform')}</option>
                        {platforms.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>

                    <div className="flex gap-2 pt-2">
                        <button onClick={() => { setChangeDialog(null); setNewPlatform(''); }} className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium">{t('dialog.cancel')}</button>
                        <button onClick={handleChangeDevice} disabled={!newPlatform || actionLoading} className="flex-1 py-2.5 bg-warning text-white rounded-xl cursor-pointer hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2">
                            {actionLoading ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('dialog.processing')}</>) : t('dialog.confirm')}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Reset Dialog */}
            <Dialog open={!!resetDialog} onClose={() => setResetDialog(null)}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">{Icons.reset}</div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-fg">{t('dialog.resetTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.resetDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-bg-secondary rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono text-xs sm:text-sm break-all">{resetDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{resetDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setResetDialog(null)} className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium">{t('dialog.cancel')}</button>
                        <button onClick={handleReset} disabled={actionLoading} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl cursor-pointer hover:bg-blue-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2">
                            {actionLoading ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('dialog.processing')}</>) : t('dialog.confirm')}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Dialog (Clears info, keeps serial) */}
            <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-danger/10 text-danger rounded-lg shrink-0">{Icons.warning}</div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-danger">{t('dialog.deleteTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.deleteDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 text-sm space-y-1">
                        <div className="text-fg-muted">{t('dialog.resetSerial')}: <span className="text-fg font-mono text-xs sm:text-sm break-all">{deleteDialog?.serial_key}</span></div>
                        <div className="text-fg-muted">{t('dialog.resetUser')}: <span className="text-fg">{deleteDialog?.customer_name || '-'}</span></div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setDeleteDialog(null)} className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium">{t('dialog.cancel')}</button>
                        <button onClick={handleDelete} disabled={actionLoading} className="flex-1 py-2.5 bg-danger text-white rounded-xl cursor-pointer hover:bg-red-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2">
                            {actionLoading ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('dialog.processing')}</>) : t('action.delete')}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Edit Table Dialog */}
            <Dialog open={!!editTableDialog} onClose={() => setEditTableDialog(null)}>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0">{Icons.editTable}</div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-fg">{t('dialog.editTableTitle')}</h3>
                            <p className="text-fg-muted text-sm mt-0.5">{t('dialog.editTableDesc')}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-fg-muted mb-1 block">{t('dialog.serialKey')}</label>
                            <input
                                type="text"
                                value={editSerial}
                                onChange={(e) => setEditSerial(e.target.value)}
                                className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-fg-muted mb-1 block">{t('dialog.customerName')}</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="-"
                                className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder-fg-muted"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-fg-muted mb-1 block">{t('dialog.customerEmail')}</label>
                            <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="-"
                                className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder-fg-muted"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-fg-muted mb-1 block">{t('dialog.deviceId')}</label>
                            <input
                                type="text"
                                value={editDeviceId}
                                onChange={(e) => setEditDeviceId(e.target.value)}
                                placeholder="-"
                                className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder-fg-muted"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setEditTableDialog(null)} className="flex-1 py-2.5 bg-bg-secondary text-fg-secondary rounded-xl cursor-pointer hover:bg-border hover:text-fg transition-all active:scale-[0.98] text-sm font-medium">{t('dialog.cancel')}</button>
                        <button onClick={handleEditTable} disabled={!editSerial || actionLoading} className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl cursor-pointer hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] text-sm font-semibold flex items-center justify-center gap-2">
                            {actionLoading ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('dialog.processing')}</>) : t('dialog.confirm')}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
