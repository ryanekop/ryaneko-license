'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/providers';

interface UserData {
    id: string;
    email: string;
    name: string;
    role: string | null;
    vendorSlug: string | null;
    tenantId: string | null;
    tenantName: string | null;
    createdAt: string;
    tier: string;
    status: string;
    expiresAt: string | null;
    lastSignIn: string | null;
    emailConfirmed: boolean;
}

interface TenantData {
    id: string;
    slug: string;
    name: string;
    domain: string | null;
    is_active: boolean;
}

interface TenantAccountData {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    vendor_slug: string | null;
    tenant_id: string | null;
    tenant_name: string | null;
}

interface BlocklistData {
    id: string;
    email: string;
    reason: string | null;
    is_active: boolean;
    suspended_user_id: string | null;
    created_at: string;
    updated_at: string;
}

// SVG Icons
const ClipboardIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
);
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? 'animate-spin' : ''}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
    </svg>
);
const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
);
const SendIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
);
const TrashIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
);
const LinkIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L12 4" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12 20" />
    </svg>
);
const SortIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
    </svg>
);
const UsersIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const ShieldIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
);
const UnlockIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
);

function getTierBadge(tier: string, status?: string) {
    if (tier === 'free' || status === 'trial') {
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">⏱️ Trial</span>;
    }
    switch (tier) {
        case 'pro_monthly':
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🔥 Pro Monthly</span>;
        case 'pro_quarterly':
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🔥 Pro Quarterly</span>;
        case 'pro_yearly':
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">🔥 Pro Yearly</span>;
        case 'lifetime':
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">👑 Lifetime</span>;
        default:
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">No Plan</span>;
    }
}

function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateString: string | null) {
    if (!dateString) return null;
    const d = new Date(dateString);
    const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { date, time };
}

function isExpired(dateString: string | null) {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
}

// Portal Dialog component
function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
            <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-[var(--shadow-lg)] animate-fade-in-scale z-10">
                {children}
            </div>
        </div>,
        document.body
    );
}

export default function ClientDeskPage() {
    const { t } = useLang();
    const [users, setUsers] = useState<UserData[]>([]);
    const [tenants, setTenants] = useState<TenantData[]>([]);
    const [blocklist, setBlocklist] = useState<BlocklistData[]>([]);
    const [loading, setLoading] = useState(false);
    const [blocklistLoading, setBlocklistLoading] = useState(false);
    const [error, setError] = useState('');
    const [blocklistError, setBlocklistError] = useState('');
    const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null);
    const [sortAsc, setSortAsc] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [blocklistSearch, setBlocklistSearch] = useState('');
    const [filterTier, setFilterTier] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'users' | 'blocklist'>('users');

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [trialDays, setTrialDays] = useState('5');
    const [createLoading, setCreateLoading] = useState(false);
    const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

    // Dialogs
    const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
    const [editUser, setEditUser] = useState<UserData | null>(null);
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [assignUser, setAssignUser] = useState<UserData | null>(null);
    const [assignTenantId, setAssignTenantId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignError, setAssignError] = useState('');
    const [blockEmail, setBlockEmail] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [blockActionLoading, setBlockActionLoading] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [usersRes, accountsRes, tenantsRes] = await Promise.all([
                fetch('/api/admin/clientdesk-users'),
                fetch('/api/admin/vendor-clientdesk-accounts'),
                fetch('/api/admin/vendor-clientdesk'),
            ]);

            const usersData = await usersRes.json();
            const accountsData = await accountsRes.json();
            const tenantsData = await tenantsRes.json();

            if (!usersData.success) {
                setError(usersData.message || 'Failed to fetch users');
                return;
            }

            if (!accountsRes.ok || !accountsData.success) {
                setError(accountsData.error || 'Failed to fetch tenant accounts');
                return;
            }

            if (!tenantsRes.ok || !Array.isArray(tenantsData)) {
                setError('Failed to fetch tenants');
                return;
            }

            const accountMap = new Map(
                ((accountsData.accounts || []) as TenantAccountData[]).map((account) => [account.id, account])
            );

            const mergedUsers = (usersData.users || []).map((user: UserData) => {
                const account = accountMap.get(user.id);
                return {
                    ...user,
                    role: account?.role || null,
                    vendorSlug: account?.vendor_slug || null,
                    tenantId: account?.tenant_id || null,
                    tenantName: account?.tenant_name || null,
                };
            });

            setUsers(mergedUsers);
            setTenants((tenantsData as TenantData[]).filter((tenant) => tenant.is_active));
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBlocklist = useCallback(async () => {
        setBlocklistLoading(true);
        setBlocklistError('');
        try {
            const params = new URLSearchParams();
            if (blocklistSearch.trim()) {
                params.set('search', blocklistSearch.trim());
            }
            const res = await fetch(`/api/admin/clientdesk-blocklist${params.toString() ? `?${params.toString()}` : ''}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                setBlocklistError(data.error || 'Failed to fetch blocklist');
                return;
            }

            setBlocklist(data.blocklist || []);
        } catch {
            setBlocklistError('Connection error');
        } finally {
            setBlocklistLoading(false);
        }
    }, [blocklistSearch]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchBlocklist(); }, [fetchBlocklist]);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 2500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const filteredUsers = users.filter((u) => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
        }
        if (filterTier !== 'all') {
            if (filterTier === 'trial') {
                if (!(u.tier === 'free' || u.status === 'trial')) return false;
            } else {
                if (u.tier !== filterTier) return false;
            }
        }
        return true;
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortAsc ? da - db : db - da;
    });

    const handleAddBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = blockEmail.trim();
        if (!email) return;

        setBlockActionLoading('add');
        setBlocklistError('');
        try {
            const res = await fetch('/api/admin/clientdesk-blocklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, reason: blockReason.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setBlocklistError(data.error || 'Failed to add blocklist entry');
                return;
            }

            setToast({ success: true, message: 'Email added to ClientDesk blocklist' });
            setBlockEmail('');
            setBlockReason('');
            await Promise.all([fetchBlocklist(), fetchUsers()]);
        } catch {
            setBlocklistError('Connection error');
        } finally {
            setBlockActionLoading(null);
        }
    };

    const handleToggleBlock = async (block: BlocklistData) => {
        setBlockActionLoading(block.id);
        setBlocklistError('');
        try {
            const res = await fetch('/api/admin/clientdesk-blocklist', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: block.id, is_active: !block.is_active }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setBlocklistError(data.error || 'Failed to update blocklist entry');
                return;
            }

            setToast({
                success: true,
                message: block.is_active ? 'Blocklist entry disabled' : 'Blocklist entry enabled',
            });
            await fetchBlocklist();
        } catch {
            setBlocklistError('Connection error');
        } finally {
            setBlockActionLoading(null);
        }
    };

    const handleDeleteBlock = async (block: BlocklistData) => {
        setBlockActionLoading(block.id);
        setBlocklistError('');
        try {
            const res = await fetch('/api/admin/clientdesk-blocklist', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: block.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setBlocklistError(data.error || 'Failed to delete blocklist entry');
                return;
            }

            setToast({ success: true, message: 'Blocklist entry deleted' });
            await fetchBlocklist();
        } catch {
            setBlocklistError('Connection error');
        } finally {
            setBlockActionLoading(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateResult(null);
        try {
            const res = await fetch('/api/admin/clientdesk-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: createName, email: createEmail, trialDays: parseInt(trialDays) }),
            });
            const data = await res.json();
            setCreateResult(data);
            if (data.success) {
                setCreateName('');
                setCreateEmail('');
                setShowCreate(false);
                fetchUsers();
            }
        } catch {
            setCreateResult({ success: false, message: 'Connection error' });
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/clientdesk-users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: deleteUser.id }),
            });
            const data = await res.json();
            if (data.success) {
                fetchUsers();
                setDeleteUser(null);
            } else {
                alert(data.message);
            }
        } catch {
            alert('Connection error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSetExpiry = async () => {
        if (!editUser || !expiryDate) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/clientdesk-users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: editUser.id, action: 'set_expiry', expiryDate: new Date(expiryDate).toISOString() }),
            });
            const data = await res.json();
            if (data.success) { fetchUsers(); setEditUser(null); }
            else alert(data.message);
        } catch { alert('Connection error'); }
        finally { setActionLoading(false); }
    };

    const handleChangeTier = async () => {
        if (!editUser || !selectedTier) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/clientdesk-users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: editUser.id, action: 'change_tier', tier: selectedTier }),
            });
            const data = await res.json();
            if (data.success) { fetchUsers(); setEditUser(null); }
            else alert(data.message);
        } catch { alert('Connection error'); }
        finally { setActionLoading(false); }
    };

    const openAssignDialog = (user: UserData) => {
        setAssignUser(user);
        setAssignTenantId(user.tenantId || '');
        setAssignError('');
    };

    const handleAssignTenant = async () => {
        if (!assignUser || !assignTenantId) {
            setAssignError(t('clientdesk.tenantRequired'));
            return;
        }

        setAssignLoading(true);
        setAssignError('');
        try {
            const res = await fetch('/api/admin/vendor-clientdesk-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile_id: assignUser.id,
                    tenant_id: assignTenantId,
                }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setAssignError(data.error || t('clientdesk.assignFailed'));
                return;
            }

            setToast({
                success: true,
                message: t('clientdesk.assignSuccess'),
            });
            setAssignUser(null);
            await fetchUsers();
        } catch {
            setAssignError('Connection error');
        } finally {
            setAssignLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && (
                <div className={`fixed right-4 top-4 z-[10000] px-4 py-2.5 rounded-xl border shadow-[var(--shadow-lg)] text-sm animate-fade-in ${
                    toast.success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-danger/10 border-danger/20 text-danger'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                        <ClipboardIcon /> {t('clientdesk.title')}
                    </h2>
                    <p className="text-fg-muted text-sm mt-1">{t('clientdesk.desc')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <SortIcon /> {sortAsc ? t('list.sortOldest') : t('list.sortNewest')}
                    </button>
                    <button
                        onClick={() => {
                            if (activeTab === 'users') {
                                fetchUsers();
                            } else {
                                fetchBlocklist();
                            }
                        }}
                        disabled={activeTab === 'users' ? loading : blocklistLoading}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshIcon spinning={activeTab === 'users' ? loading : blocklistLoading} /> {t('clientdesk.refresh')}
                    </button>
                    {activeTab === 'users' && (
                        <button
                            onClick={() => setShowCreate(!showCreate)}
                            className="px-3 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            <PlusIcon /> {t('clientdesk.newUser')}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="inline-flex rounded-xl border border-border bg-bg-card p-1 shadow-[var(--shadow)]">
                {[
                    { key: 'users' as const, label: 'Users', icon: <UsersIcon /> },
                    { key: 'blocklist' as const, label: 'Blocklist', icon: <ShieldIcon /> },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                            activeTab === tab.key
                                ? 'bg-accent text-accent-fg shadow-sm'
                                : 'text-fg-secondary hover:bg-bg-secondary hover:text-fg'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            {activeTab === 'users' ? (
            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('clientdesk.searchPlaceholder')}
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                />
            </div>
            ) : (
            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    value={blocklistSearch}
                    onChange={(e) => setBlocklistSearch(e.target.value)}
                    placeholder="Search blocked email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                />
            </div>
            )}

            {/* Tier Filter */}
            {activeTab === 'users' && <div className="flex flex-wrap gap-1.5">
                {[
                    { key: 'all', label: `📋 ${t('clientdesk.filterAll')}` },
                    { key: 'trial', label: '⏱️ Trial' },
                    { key: 'pro_monthly', label: '🔥 Monthly' },
                    { key: 'pro_quarterly', label: '🔥 Quarterly' },
                    { key: 'pro_yearly', label: '🔥 Yearly' },
                    { key: 'lifetime', label: '👑 Lifetime' },
                ].map((f) => {
                    const count = f.key === 'all' ? users.length : users.filter(u => f.key === 'trial' ? (u.tier === 'free' || u.status === 'trial') : u.tier === f.key).length;
                    return (
                        <button
                            key={f.key}
                            onClick={() => setFilterTier(f.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all active:scale-95 ${filterTier === f.key
                                ? 'bg-accent text-accent-fg shadow-sm'
                                : 'bg-bg-card border border-border text-fg-secondary hover:bg-bg-secondary hover:text-fg'
                                }`}
                        >
                            {f.label} ({count})
                        </button>
                    );
                })}
            </div>}

            {/* Create Form */}
            {activeTab === 'users' && showCreate && (
                <div className="bg-bg-card rounded-xl border border-border p-5 shadow-[var(--shadow)] animate-slide-up">
                    <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
                        <SendIcon /> {t('clientdesk.inviteTitle')}
                    </h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <input
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder={t('clientdesk.namePlaceholder')}
                            required
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        />
                        <input
                            type="email"
                            value={createEmail}
                            onChange={(e) => setCreateEmail(e.target.value)}
                            placeholder={t('clientdesk.emailPlaceholder')}
                            required
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        />
                        <select
                            value={trialDays}
                            onChange={(e) => setTrialDays(e.target.value)}
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        >
                            <option value="1">1 {t('clientdesk.day')}</option>
                            <option value="3">3 {t('clientdesk.days')}</option>
                            <option value="5">5 {t('clientdesk.days')}</option>
                            <option value="7">7 {t('clientdesk.days')}</option>
                            <option value="14">14 {t('clientdesk.days')}</option>
                        </select>
                        <button
                            type="submit"
                            disabled={createLoading}
                            className="px-4 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {createLoading ? (
                                <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                            ) : (
                                <><SendIcon /> {t('clientdesk.sendInvite')}</>
                            )}
                        </button>
                    </form>
                    {createResult && (
                        <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${createResult.success ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-danger/10 text-danger'}`}>
                            {createResult.message}
                        </div>
                    )}
                </div>
            )}

            {/* User Count */}
            {activeTab === 'users' && <div className="flex items-center gap-2 text-fg-muted text-sm">
                <UsersIcon /> {t('clientdesk.userCount')}: <span className="font-semibold text-fg">{filteredUsers.length}</span>{filterTier !== 'all' && <span className="text-fg-muted"> / {users.length}</span>}
            </div>}

            {/* Error */}
            {activeTab === 'users' && error && (
                <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                    {error}
                </div>
            )}

            {/* Loading */}
            {activeTab === 'users' && loading && users.length === 0 && (
                <div className="flex items-center justify-center py-12">
                    <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
            )}

            {/* Users Table */}
            {activeTab === 'users' && (!loading && users.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                    {t('clientdesk.noUsers')}
                </div>
            ) : users.length > 0 && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-auto max-h-[calc(100vh-320px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)]">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                                <tr className="text-left text-fg text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium w-12">No.</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colName')}</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colEmail')}</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colPlan')}</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colExpiry')}</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colRegistered')}</th>
                                    <th className="px-4 py-3 font-medium">{t('clientdesk.colLastLogin')}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t('clientdesk.colActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light">
                                {sortedUsers.map((user, i) => (
                                    <tr key={user.id} className="row-animate text-fg hover:bg-bg-secondary/50 transition-colors" style={{ animationDelay: `${i * 0.02}s` }}>
                                        <td className="px-4 py-2.5 text-sm text-fg-muted">{i + 1}</td>
                                        <td className="px-4 py-2.5 text-sm font-medium">{user.name}</td>
                                        <td className="px-4 py-2.5 text-sm">{user.email}</td>
                                        <td className="px-4 py-2.5">{getTierBadge(user.tier, user.status)}</td>
                                        <td className="px-4 py-2.5 text-sm">
                                            {user.tier === 'lifetime' ? (
                                                <span className="text-amber-500 font-medium">∞ {t('clientdesk.never')}</span>
                                            ) : (
                                                <span className={isExpired(user.expiresAt) ? 'text-danger font-medium' : ''}>
                                                    {formatDate(user.expiresAt)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm">{formatDate(user.createdAt)}</td>
                                        <td className="px-4 py-2.5 text-sm">
                                            {!user.emailConfirmed ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">⚠️ {t('clientdesk.unverified')}</span>
                                            ) : user.lastSignIn ? (
                                                <div>
                                                    <span>{formatDateTime(user.lastSignIn)?.date}</span>
                                                    <span className="text-fg-muted ml-1 text-xs">{formatDateTime(user.lastSignIn)?.time}</span>
                                                </div>
                                            ) : (
                                                <span className="text-fg-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => openAssignDialog(user)}
                                                    className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-indigo-600 transition-all active:scale-90 flex items-center gap-1"
                                                    title={user.tenantId ? t('clientdesk.reassign') : t('clientdesk.assign')}
                                                >
                                                    <LinkIcon /> {user.tenantId ? t('clientdesk.reassign') : t('clientdesk.assign')}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditUser(user);
                                                        setSelectedTier(user.tier === 'free' ? 'free' : user.tier);
                                                        setExpiryDate(user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-600 transition-all active:scale-90 flex items-center gap-1"
                                                    title="Edit"
                                                >
                                                    <EditIcon /> Edit
                                                </button>
                                                <button
                                                    onClick={() => setDeleteUser(user)}
                                                    className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-red-600 transition-all active:scale-90 flex items-center gap-1"
                                                    title="Delete"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {sortedUsers.map((user, i) => (
                            <div key={user.id} className="bg-bg-card rounded-xl border border-border p-4 shadow-[var(--shadow)] animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-semibold text-fg text-sm">{user.name}</p>
                                        <p className="text-fg-muted text-xs">{user.email}</p>
                                    </div>
                                    {getTierBadge(user.tier, user.status)}
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light">
                                    <div className="text-xs text-fg-muted space-y-0.5">
                                        <p>{t('clientdesk.colExpiry')}: {user.tier === 'lifetime' ? <span className="text-amber-500">∞</span> : <span className={isExpired(user.expiresAt) ? 'text-danger' : ''}>{formatDate(user.expiresAt)}</span>}</p>
                                        <p>{t('clientdesk.colRegistered')}: {formatDate(user.createdAt)}</p>
                                        <p>{t('clientdesk.colLastLogin')}: {!user.emailConfirmed ? <span className="text-red-500 font-medium">⚠️ {t('clientdesk.unverified')}</span> : user.lastSignIn ? <span>{formatDateTime(user.lastSignIn)?.date} {formatDateTime(user.lastSignIn)?.time}</span> : '—'}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => openAssignDialog(user)}
                                            className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-indigo-600 transition-all active:scale-90 flex items-center gap-1"
                                        >
                                            <LinkIcon /> {user.tenantId ? t('clientdesk.reassign') : t('clientdesk.assign')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditUser(user);
                                                setSelectedTier(user.tier === 'free' ? 'free' : user.tier);
                                                setExpiryDate(user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
                                            }}
                                            className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-600 transition-all active:scale-90 flex items-center gap-1"
                                        >
                                            <EditIcon /> Edit
                                        </button>
                                        <button
                                            onClick={() => setDeleteUser(user)}
                                            className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-red-600 transition-all active:scale-90 flex items-center gap-1"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ))}

            {activeTab === 'blocklist' && (
                <div className="space-y-4">
                    <form onSubmit={handleAddBlock} className="bg-bg-card rounded-xl border border-border p-5 shadow-[var(--shadow)]">
                        <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
                            <ShieldIcon /> Add Blocked Email
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3">
                            <input
                                type="email"
                                value={blockEmail}
                                onChange={(e) => setBlockEmail(e.target.value)}
                                placeholder="email@example.com"
                                required
                                className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                            />
                            <input
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="Internal note"
                                className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                            />
                            <button
                                type="submit"
                                disabled={blockActionLoading === 'add'}
                                className="px-4 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {blockActionLoading === 'add' ? (
                                    <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                                ) : (
                                    <><ShieldIcon /> Block</>
                                )}
                            </button>
                        </div>
                    </form>

                    {blocklistError && (
                        <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                            {blocklistError}
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-fg-muted text-sm">
                        <ShieldIcon /> Blocklist: <span className="font-semibold text-fg">{blocklist.length}</span>
                    </div>

                    {blocklistLoading && blocklist.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        </div>
                    ) : blocklist.length === 0 ? (
                        <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                            No blocked emails yet
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-[calc(100vh-360px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)]">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                                    <tr className="text-left text-fg text-xs uppercase tracking-wider">
                                        <th className="px-4 py-3 font-medium">Email</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Existing User</th>
                                        <th className="px-4 py-3 font-medium">Reason</th>
                                        <th className="px-4 py-3 font-medium">Updated</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light">
                                    {blocklist.map((block) => (
                                        <tr key={block.id} className="text-fg hover:bg-bg-secondary/50 transition-colors">
                                            <td className="px-4 py-2.5 text-sm font-medium">{block.email}</td>
                                            <td className="px-4 py-2.5">
                                                {block.is_active ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">Active</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Disabled</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm">
                                                {block.suspended_user_id ? (
                                                    <span className="font-mono text-xs text-fg-muted">{block.suspended_user_id}</span>
                                                ) : (
                                                    <span className="text-fg-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-fg-secondary max-w-[240px] truncate" title={block.reason || ''}>
                                                {block.reason || <span className="text-fg-muted">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm">{formatDate(block.updated_at)}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleToggleBlock(block)}
                                                        disabled={blockActionLoading === block.id}
                                                        className={`px-2.5 py-1.5 text-white rounded-lg text-xs font-medium cursor-pointer transition-all active:scale-90 disabled:opacity-50 flex items-center gap-1 ${
                                                            block.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                                                        }`}
                                                    >
                                                        {block.is_active ? <UnlockIcon /> : <ShieldIcon />}
                                                        {block.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBlock(block)}
                                                        disabled={blockActionLoading === block.id}
                                                        className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-red-600 transition-all active:scale-90 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <TrashIcon /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Dialog */}
            <Dialog open={!!deleteUser} onClose={() => setDeleteUser(null)}>
                <h3 className="text-lg font-semibold text-fg mb-2">{t('clientdesk.deleteTitle')}</h3>
                <p className="text-fg-muted text-sm mb-6">
                    {t('clientdesk.deleteConfirm')} <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
                </p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setDeleteUser(null)} className="px-4 py-2 bg-bg border border-border rounded-xl text-sm text-fg cursor-pointer hover:bg-bg-secondary transition-all">
                        {t('dialog.cancel')}
                    </button>
                    <button onClick={handleDelete} disabled={actionLoading} className="px-4 py-2 bg-danger text-white rounded-xl text-sm font-medium cursor-pointer hover:opacity-85 transition-all disabled:opacity-50 flex items-center gap-2">
                        {actionLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <TrashIcon />}
                        {t('action.delete')}
                    </button>
                </div>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editUser} onClose={() => setEditUser(null)}>
                <h3 className="text-lg font-semibold text-fg mb-1">{t('clientdesk.editTitle')}</h3>
                <p className="text-fg-muted text-sm mb-5">
                    {t('clientdesk.editDesc')} <strong>{editUser?.name}</strong>
                </p>

                {/* Set Expiry */}
                <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium text-fg">{t('clientdesk.setExpiry')}</label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="flex-1 px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                        <button
                            onClick={handleSetExpiry}
                            disabled={actionLoading || !expiryDate}
                            className="px-4 py-2 bg-accent text-accent-fg rounded-xl text-sm font-medium cursor-pointer hover:opacity-85 transition-all disabled:opacity-50"
                        >
                            {t('clientdesk.save')}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center"><span className="bg-bg-card px-3 text-xs text-fg-muted uppercase">{t('clientdesk.or')}</span></div>
                </div>

                {/* Change Tier */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-fg">{t('clientdesk.changeTier')}</label>
                    <div className="flex gap-2">
                        <select
                            value={selectedTier}
                            onChange={(e) => setSelectedTier(e.target.value)}
                            className="flex-1 px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20"
                        >
                            <option value="free">⏱️ Trial (15 hari)</option>
                            <option value="pro_monthly">🔥 Pro Monthly</option>
                            <option value="pro_quarterly">🔥 Pro Quarterly</option>
                            <option value="pro_yearly">🔥 Pro Yearly</option>
                            <option value="lifetime">👑 Lifetime</option>
                        </select>
                        <button
                            onClick={handleChangeTier}
                            disabled={actionLoading || !selectedTier}
                            className="px-4 py-2 bg-accent text-accent-fg rounded-xl text-sm font-medium cursor-pointer hover:opacity-85 transition-all disabled:opacity-50"
                        >
                            {t('clientdesk.change')}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Assign Tenant Dialog */}
            <Dialog open={!!assignUser} onClose={() => setAssignUser(null)}>
                <h3 className="text-lg font-semibold text-fg mb-1">
                    {assignUser?.tenantId ? t('clientdesk.reassignTitle') : t('clientdesk.assignTitle')}
                </h3>
                <p className="text-fg-muted text-sm mb-5">
                    {t('clientdesk.assignDesc')} <strong>{assignUser?.name}</strong>
                </p>

                <div className="space-y-3">
                    <div className="bg-bg rounded-xl border border-border p-3">
                        <p className="text-xs text-fg-muted">{t('clientdesk.currentTenant')}</p>
                        <p className="text-sm font-medium text-fg mt-0.5">
                            {assignUser?.tenantName || t('clientdesk.noTenantAssigned')}
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-fg">{t('clientdesk.selectTenant')}</label>
                        <select
                            value={assignTenantId}
                            onChange={(e) => setAssignTenantId(e.target.value)}
                            className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20"
                        >
                            <option value="">{t('clientdesk.selectTenant')}</option>
                            {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name} {tenant.domain ? `(${tenant.domain})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {assignError && (
                        <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                            {assignError}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={() => setAssignUser(null)}
                        className="px-4 py-2 bg-bg border border-border rounded-xl text-sm text-fg cursor-pointer hover:bg-bg-secondary transition-all"
                    >
                        {t('dialog.cancel')}
                    </button>
                    <button
                        onClick={handleAssignTenant}
                        disabled={assignLoading}
                        className="px-4 py-2 bg-accent text-accent-fg rounded-xl text-sm font-medium cursor-pointer hover:opacity-85 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {assignLoading ? (
                            <span className="w-3.5 h-3.5 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                        ) : (
                            <LinkIcon />
                        )}
                        {assignLoading ? t('clientdesk.assigning') : t('clientdesk.assignSave')}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}
