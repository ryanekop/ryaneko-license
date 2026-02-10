'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/providers';

interface UserData {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    tier: string;
    status: string;
    expiresAt: string | null;
}

// SVG Icons
const CameraIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
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

export default function FastpikPage() {
    const { t } = useLang();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortAsc, setSortAsc] = useState(false);

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [trialDays, setTrialDays] = useState('3');
    const [createLoading, setCreateLoading] = useState(false);
    const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

    // Dialogs
    const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
    const [editUser, setEditUser] = useState<UserData | null>(null);
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/fastpik-users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            } else {
                setError(data.message || 'Failed to fetch users');
            }
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const sortedUsers = [...users].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortAsc ? da - db : db - da;
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateResult(null);
        try {
            const res = await fetch('/api/admin/fastpik-users', {
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
            const res = await fetch('/api/admin/fastpik-users', {
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
            const res = await fetch('/api/admin/fastpik-users', {
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
            const res = await fetch('/api/admin/fastpik-users', {
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                        <CameraIcon /> {t('fastpik.title')}
                    </h2>
                    <p className="text-fg-muted text-sm mt-1">{t('fastpik.desc')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <SortIcon /> {sortAsc ? t('list.sortOldest') : t('list.sortNewest')}
                    </button>
                    <button
                        onClick={fetchUsers}
                        disabled={loading}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshIcon spinning={loading} /> {t('fastpik.refresh')}
                    </button>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="px-3 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <PlusIcon /> {t('fastpik.newUser')}
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="bg-bg-card rounded-xl border border-border p-5 shadow-[var(--shadow)] animate-slide-up">
                    <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
                        <SendIcon /> {t('fastpik.inviteTitle')}
                    </h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <input
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder={t('fastpik.namePlaceholder')}
                            required
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        />
                        <input
                            type="email"
                            value={createEmail}
                            onChange={(e) => setCreateEmail(e.target.value)}
                            placeholder={t('fastpik.emailPlaceholder')}
                            required
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        />
                        <select
                            value={trialDays}
                            onChange={(e) => setTrialDays(e.target.value)}
                            className="px-3 py-2.5 bg-bg border border-border rounded-xl text-fg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        >
                            <option value="1">1 {t('fastpik.day')}</option>
                            <option value="2">2 {t('fastpik.days')}</option>
                            <option value="3">3 {t('fastpik.days')}</option>
                            <option value="5">5 {t('fastpik.days')}</option>
                            <option value="7">7 {t('fastpik.days')}</option>
                        </select>
                        <button
                            type="submit"
                            disabled={createLoading}
                            className="px-4 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {createLoading ? (
                                <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                            ) : (
                                <><SendIcon /> {t('fastpik.sendInvite')}</>
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
            <div className="flex items-center gap-2 text-fg-muted text-sm">
                <UsersIcon /> {t('fastpik.userCount')}: <span className="font-semibold text-fg">{users.length}</span>
            </div>

            {/* Error */}
            {error && (
                <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && users.length === 0 && (
                <div className="flex items-center justify-center py-12">
                    <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
            )}

            {/* Users Table */}
            {!loading && users.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                    {t('fastpik.noUsers')}
                </div>
            ) : users.length > 0 && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-auto max-h-[calc(100vh-320px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)]">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                                <tr className="text-left text-fg-muted text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium">{t('fastpik.colName')}</th>
                                    <th className="px-4 py-3 font-medium">{t('fastpik.colEmail')}</th>
                                    <th className="px-4 py-3 font-medium">{t('fastpik.colPlan')}</th>
                                    <th className="px-4 py-3 font-medium">{t('fastpik.colExpiry')}</th>
                                    <th className="px-4 py-3 font-medium">{t('fastpik.colRegistered')}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t('fastpik.colActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light">
                                {sortedUsers.map((user, i) => (
                                    <tr key={user.id} className="table-row text-fg hover:bg-bg-secondary/50 transition-colors" style={{ animationDelay: `${i * 0.02}s` }}>
                                        <td className="px-4 py-2.5 text-sm font-medium">{user.name}</td>
                                        <td className="px-4 py-2.5 text-sm text-fg-muted">{user.email}</td>
                                        <td className="px-4 py-2.5">{getTierBadge(user.tier, user.status)}</td>
                                        <td className="px-4 py-2.5 text-sm">
                                            {user.tier === 'lifetime' ? (
                                                <span className="text-amber-500 font-medium">∞ {t('fastpik.never')}</span>
                                            ) : (
                                                <span className={isExpired(user.expiresAt) ? 'text-danger font-medium' : 'text-fg-muted'}>
                                                    {formatDate(user.expiresAt)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-fg-muted">{formatDate(user.createdAt)}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        setEditUser(user);
                                                        setSelectedTier(user.tier === 'free' ? 'free' : user.tier);
                                                        setExpiryDate(user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
                                                    }}
                                                    className="p-2 text-blue-500 cursor-pointer hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all active:scale-90"
                                                    title="Edit"
                                                >
                                                    <EditIcon />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteUser(user)}
                                                    className="p-2 text-red-500 cursor-pointer hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-90"
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
                                        <p>{t('fastpik.colExpiry')}: {user.tier === 'lifetime' ? <span className="text-amber-500">∞</span> : <span className={isExpired(user.expiresAt) ? 'text-danger' : ''}>{formatDate(user.expiresAt)}</span>}</p>
                                        <p>{t('fastpik.colRegistered')}: {formatDate(user.createdAt)}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => {
                                                setEditUser(user);
                                                setSelectedTier(user.tier === 'free' ? 'free' : user.tier);
                                                setExpiryDate(user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
                                            }}
                                            className="p-2 bg-bg border border-border rounded-lg text-blue-500 cursor-pointer hover:text-blue-700 transition-all active:scale-90"
                                        >
                                            <EditIcon />
                                        </button>
                                        <button
                                            onClick={() => setDeleteUser(user)}
                                            className="p-2 bg-bg border border-border rounded-lg text-red-500 cursor-pointer hover:text-red-700 transition-all active:scale-90"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Delete Dialog */}
            <Dialog open={!!deleteUser} onClose={() => setDeleteUser(null)}>
                <h3 className="text-lg font-semibold text-fg mb-2">{t('fastpik.deleteTitle')}</h3>
                <p className="text-fg-muted text-sm mb-6">
                    {t('fastpik.deleteConfirm')} <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
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
                <h3 className="text-lg font-semibold text-fg mb-1">{t('fastpik.editTitle')}</h3>
                <p className="text-fg-muted text-sm mb-5">
                    {t('fastpik.editDesc')} <strong>{editUser?.name}</strong>
                </p>

                {/* Set Expiry */}
                <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium text-fg">{t('fastpik.setExpiry')}</label>
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
                            {t('fastpik.save')}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center"><span className="bg-bg-card px-3 text-xs text-fg-muted uppercase">{t('fastpik.or')}</span></div>
                </div>

                {/* Change Tier */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-fg">{t('fastpik.changeTier')}</label>
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
                            {t('fastpik.change')}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
