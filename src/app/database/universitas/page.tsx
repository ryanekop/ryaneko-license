'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/providers';

interface University {
    id: string;
    name: string;
    abbreviation: string | null;
    created_at: string;
    updated_at: string;
}

interface UniversitiesResponse {
    items: University[];
    total: number;
    page: number;
    pageSize: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const DatabaseIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
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

const SearchIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
);

const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

function formatDate(dateString: string) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
            <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-[var(--shadow-lg)] animate-fade-in-scale z-10 max-h-[90vh] overflow-y-auto">
                {children}
            </div>
        </div>,
        document.body
    );
}

export default function UniversitiesPage() {
    const { t } = useLang();
    const [universities, setUniversities] = useState<University[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [editingUniversity, setEditingUniversity] = useState<University | null>(null);
    const [formName, setFormName] = useState('');
    const [formAbbreviation, setFormAbbreviation] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formResult, setFormResult] = useState<{ success: boolean; message: string } | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<University | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    const fetchUniversities = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                q: debouncedSearch,
                page: String(page),
                pageSize: String(pageSize),
            });

            const res = await fetch(`/api/admin/universities?${params.toString()}`);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setUniversities(data);
                setTotal(data.length);
                return;
            }

            const parsed = data as UniversitiesResponse;
            setUniversities(Array.isArray(parsed.items) ? parsed.items : []);
            setTotal(typeof parsed.total === 'number' ? parsed.total : 0);
            if (typeof parsed.page === 'number') {
                setPage(parsed.page);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, page, pageSize]);

    useEffect(() => {
        fetchUniversities();
    }, [fetchUniversities]);

    const openCreate = () => {
        setEditingUniversity(null);
        setFormName('');
        setFormAbbreviation('');
        setFormResult(null);
        setShowForm(true);
    };

    const openEdit = (university: University) => {
        setEditingUniversity(university);
        setFormName(university.name);
        setFormAbbreviation(university.abbreviation || '');
        setFormResult(null);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanName = formName.trim();
        const cleanAbbreviation = formAbbreviation.trim();

        if (!cleanName || !cleanAbbreviation) {
            setFormResult({ success: false, message: t('database.required') });
            return;
        }

        setFormLoading(true);
        setFormResult(null);

        try {
            const body = editingUniversity
                ? { id: editingUniversity.id, name: cleanName, abbreviation: cleanAbbreviation }
                : { name: cleanName, abbreviation: cleanAbbreviation };

            const res = await fetch('/api/admin/universities', {
                method: editingUniversity ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    if (data?.error === 'name already exists') {
                        setFormResult({ success: false, message: t('database.duplicateName') });
                    } else {
                        setFormResult({ success: false, message: t('database.duplicate') });
                    }
                } else {
                    setFormResult({ success: false, message: data.error || 'Failed' });
                }
                return;
            }

            const isUpgraded = !editingUniversity && res.status === 200 && data?.action === 'upgraded';
            setFormResult({
                success: true,
                message: isUpgraded
                    ? t('database.upgraded')
                    : editingUniversity
                        ? t('database.updated')
                        : t('database.created'),
            });
            await fetchUniversities();
            setTimeout(() => setShowForm(false), 900);
        } catch {
            setFormResult({ success: false, message: 'Connection error' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/admin/universities?id=${deleteTarget.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete university');
            }

            await fetchUniversities();
            setDeleteTarget(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                        <DatabaseIcon /> {t('database.universitiesTitle')}
                    </h2>
                    <p className="text-fg-muted text-sm mt-1">{t('database.universitiesDesc')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchUniversities}
                        disabled={loading}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshIcon spinning={loading} /> {t('database.refresh')}
                    </button>
                    <button
                        onClick={openCreate}
                        className="px-3 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <PlusIcon /> {t('database.add')}
                    </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative w-full sm:max-w-md">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('database.search')}
                        className="w-full pl-8 pr-3 py-2.5 bg-bg-card border border-border rounded-lg text-sm text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none">
                        <SearchIcon />
                    </div>
                </div>
                <div className="text-sm text-fg-muted">
                    {t('database.total')}: <span className="font-semibold text-fg">{total}</span>
                    {loading && <span className="ml-2 text-xs">{t('list.loading')}</span>}
                </div>
            </div>

            {error && (
                <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto bg-bg-card border border-border rounded-xl shadow-[var(--shadow)]">
                <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-bg-secondary text-fg-secondary text-xs uppercase tracking-wide">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">{t('database.colName')}</th>
                            <th className="px-4 py-3 text-left font-semibold">{t('database.colAbbreviation')}</th>
                            <th className="px-4 py-3 text-left font-semibold">{t('database.colCreatedAt')}</th>
                            <th className="px-4 py-3 text-right font-semibold">{t('database.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && universities.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center">
                                    <span className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                </td>
                            </tr>
                        ) : universities.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-fg-muted">
                                    {t('database.empty')}
                                </td>
                            </tr>
                        ) : (
                            universities.map((university) => (
                                <tr key={university.id} className="border-t border-border-light hover:bg-bg-secondary/70 transition-colors">
                                    <td className="px-4 py-3.5 text-fg font-medium">{university.name}</td>
                                    <td className="px-4 py-3.5">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-fg border border-border">
                                            {university.abbreviation || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-fg-secondary">{formatDate(university.created_at)}</td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => openEdit(university)}
                                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <EditIcon /> {t('database.edit')}
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(university)}
                                                className="px-3 py-1.5 bg-red-500/10 text-red-600 rounded-lg text-xs font-medium cursor-pointer hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <TrashIcon /> {t('database.delete')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-fg-secondary">
                    <span>{t('database.rowsPerPage')}</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            const value = Number.parseInt(e.target.value, 10);
                            if (PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number])) {
                                setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number]);
                                setPage(1);
                            }
                        }}
                        disabled={loading}
                        className="px-2 py-1.5 bg-bg-card border border-border rounded-lg text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                    >
                        {PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={loading || page <= 1}
                        className="px-3 py-2 border border-border rounded-lg text-sm text-fg-secondary cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 disabled:opacity-60"
                    >
                        {t('database.prev')}
                    </button>
                    <div className="text-sm text-fg-secondary min-w-[120px] text-center">
                        {t('database.page')} {page} / {totalPages}
                    </div>
                    <button
                        type="button"
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={loading || page >= totalPages}
                        className="px-3 py-2 border border-border rounded-lg text-sm text-fg-secondary cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 disabled:opacity-60"
                    >
                        {t('database.next')}
                    </button>
                </div>
            </div>

            <Dialog open={showForm} onClose={() => setShowForm(false)}>
                <h3 className="text-lg font-semibold text-fg mb-5">
                    {editingUniversity ? t('database.editTitle') : t('database.createTitle')}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1.5">{t('database.formName')}</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-fg-muted mb-1.5">{t('database.formAbbreviation')}</label>
                        <input
                            type="text"
                            value={formAbbreviation}
                            onChange={(e) => setFormAbbreviation(e.target.value)}
                            className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                            required
                        />
                    </div>

                    {formResult && (
                        <div className={`text-sm rounded-lg px-3 py-2 border ${formResult.success
                            ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-danger bg-danger/10 border-danger/20'
                            }`}>
                            {formResult.message}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-3 py-2 border border-border rounded-lg text-sm text-fg-secondary cursor-pointer hover:bg-bg-secondary transition-all active:scale-95"
                        >
                            {t('database.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="px-3 py-2 bg-accent text-accent-fg rounded-lg text-sm font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 disabled:opacity-60"
                        >
                            {formLoading ? t('database.formSaving') : t('database.formSave')}
                        </button>
                    </div>
                </form>
            </Dialog>

            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <h3 className="text-lg font-semibold text-fg mb-2">{t('database.deleteTitle')}</h3>
                <p className="text-sm text-fg-muted mb-4">
                    {t('database.deleteDesc')}
                    {deleteTarget && (
                        <span className="block mt-2 text-fg font-medium">
                            {deleteTarget.name} ({deleteTarget.abbreviation || '—'})
                        </span>
                    )}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="px-3 py-2 border border-border rounded-lg text-sm text-fg-secondary cursor-pointer hover:bg-bg-secondary transition-all active:scale-95"
                    >
                        {t('database.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-red-700 transition-all active:scale-95 disabled:opacity-60"
                    >
                        {deleteLoading ? t('database.formSaving') : t('database.delete')}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}
