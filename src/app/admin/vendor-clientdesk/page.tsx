'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AdminModal } from '@/components/AdminModal';
import { Pagination } from '@/components/Pagination';
import { ProductSubnav, ProductSubnavIcons, type ProductSubnavKey } from '@/components/ProductSubnav';
import { VendorAssetField } from '@/components/VendorAssetField';
import { DEFAULT_PAGE_SIZE, type PageSize, type PaginationMeta } from '@/lib/pagination';
import { useLang } from '@/lib/providers';
import { resolveTenantAssetUrl } from '@/lib/tenant-asset-url';
import { cleanupVendorAssets, uploadVendorAsset } from '@/lib/vendor-asset-client';
import { createVendorSlug } from '@/lib/vendor-slug';
import type { VendorSortMode } from '@/lib/vendor-sort';

interface TenantData {
    id: string;
    slug: string;
    name: string;
    domain: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string | null;
    footer_text: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// SVG Icons
const ClipboardIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
);
const StoreIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
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
const SortIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
    </svg>
);
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
);
const TrashIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
    </svg>
);
const GlobeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
);

function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDeleteSuccessMessage(lang: 'id' | 'en', baseMessage: string, unassignedAccounts?: number) {
    if (!Number.isFinite(unassignedAccounts) || !unassignedAccounts || unassignedAccounts <= 0) {
        return baseMessage;
    }

    return lang === 'id'
        ? `${baseMessage} ${unassignedAccounts} akun dilepas dari tenant.`
        : `${baseMessage} ${unassignedAccounts} account${unassignedAccounts === 1 ? '' : 's'} unassigned from the tenant.`;
}

// Portal Dialog component
function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    return <AdminModal open={open} onClose={onClose} className="max-w-lg">{children}</AdminModal>;
}



export default function VendorClientDeskPage() {
    const { t, lang } = useLang();
    const router = useRouter();
    const [tenants, setTenants] = useState<TenantData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortMode, setSortMode] = useState<VendorSortMode>('newest');
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 });
    const requestRef = useRef<AbortController | null>(null);

    // Create/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
    const [formSlug, setFormSlug] = useState('');
    const [formName, setFormName] = useState('');
    const [formDomain, setFormDomain] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [formFaviconUrl, setFormFaviconUrl] = useState('');
    const [formLogoFile, setFormLogoFile] = useState<File | null>(null);
    const [formFaviconFile, setFormFaviconFile] = useState<File | null>(null);

    const [formFooter, setFormFooter] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formResult, setFormResult] = useState<{ success: boolean; message: string } | null>(null);
    const [deleteTenant, setDeleteTenant] = useState<TenantData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleteSuccess, setDeleteSuccess] = useState('');



    const fetchTenants = useCallback(async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize), q: debouncedSearch, sort: sortMode });
            const res = await fetch(`/api/admin/vendor-clientdesk?${params}`, { signal: controller.signal });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setTenants(Array.isArray(data) ? data : data.items || []);
            if (data.pagination) setPagination(data.pagination);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            if (requestRef.current === controller) setLoading(false);
        }
    }, [debouncedSearch, pagination.page, pagination.pageSize, sortMode]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);
    useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300); return () => window.clearTimeout(timer); }, [searchQuery]);
    useEffect(() => { setPagination((current) => ({ ...current, page: 1 })); }, [debouncedSearch, sortMode]);

    const openCreate = () => {
        setEditingTenant(null);
        setFormSlug('');
        setFormName('');
        setFormDomain('');
        setFormLogoUrl('');
        setFormFaviconUrl('');
        setFormLogoFile(null);
        setFormFaviconFile(null);

        setFormFooter('');
        setFormResult(null);
        setShowForm(true);
    };

    const openDelete = (tenant: TenantData) => {
        setDeleteTenant(tenant);
        setDeleteError('');
    };

    const closeDelete = () => {
        if (deleteLoading) return;
        setDeleteTenant(null);
        setDeleteError('');
    };

    const openEdit = (tenant: TenantData) => {
        setEditingTenant(tenant);
        setFormSlug(tenant.slug);
        setFormName(tenant.name);
        setFormDomain(tenant.domain || '');
        setFormLogoUrl(tenant.logo_url || '');
        setFormFaviconUrl(tenant.favicon_url || '');
        setFormLogoFile(null);
        setFormFaviconFile(null);

        setFormFooter(tenant.footer_text || '');
        setFormResult(null);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormResult(null);
        try {
            const slugForPayload = editingTenant ? formSlug : createVendorSlug(formName);
            if (!slugForPayload) {
                setFormResult({ success: false, message: 'Slug is required' });
                return;
            }

            const uploadedUrls: string[] = [];
            let nextLogoUrl = formLogoUrl || null;
            let nextFaviconUrl = formFaviconUrl || null;

            try {
                if (formLogoFile) {
                    const uploaded = await uploadVendorAsset({ product: 'clientdesk', tenantSlug: slugForPayload, assetType: 'logo', file: formLogoFile });
                    nextLogoUrl = uploaded.url;
                    uploadedUrls.push(uploaded.url);
                }
                if (formFaviconFile) {
                    const uploaded = await uploadVendorAsset({ product: 'clientdesk', tenantSlug: slugForPayload, assetType: 'favicon', file: formFaviconFile });
                    nextFaviconUrl = uploaded.url;
                    uploadedUrls.push(uploaded.url);
                }

                const body = editingTenant
                    ? { id: editingTenant.id, slug: slugForPayload, name: formName, domain: formDomain || null, logo_url: nextLogoUrl, favicon_url: nextFaviconUrl, footer_text: formFooter || null }
                    : { slug: slugForPayload, name: formName, domain: formDomain || null, logo_url: nextLogoUrl, favicon_url: nextFaviconUrl, footer_text: formFooter || null };

                const res = await fetch('/api/admin/vendor-clientdesk', {
                    method: editingTenant ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || 'Failed');

                if (editingTenant) {
                    const replacedUrls = [
                        editingTenant.logo_url && editingTenant.logo_url !== nextLogoUrl ? editingTenant.logo_url : null,
                        editingTenant.favicon_url && editingTenant.favicon_url !== nextFaviconUrl ? editingTenant.favicon_url : null,
                    ];
                    void cleanupVendorAssets({ product: 'clientdesk', tenantSlug: slugForPayload, urls: replacedUrls });
                }

                setFormResult({ success: true, message: editingTenant ? t('vendor.updated') : t('vendor.created') });
                fetchTenants();
                setTimeout(() => setShowForm(false), 1000);
            } catch (error) {
                await cleanupVendorAssets({ product: 'clientdesk', tenantSlug: slugForPayload, urls: uploadedUrls });
                throw error;
            }
        } catch (error) {
            setFormResult({ success: false, message: error instanceof Error ? error.message : t('vendor.assetUploadFailed') });
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleActive = async (tenant: TenantData) => {
        try {
            await fetch('/api/admin/vendor-clientdesk', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tenant.id, is_active: !tenant.is_active }),
            });
            fetchTenants();
        } catch {
            alert('Connection error');
        }
    };

    const handleDelete = async () => {
        if (!deleteTenant) return;
        setDeleteLoading(true);
        setDeleteError('');
        setDeleteSuccess('');
        try {
            const res = await fetch('/api/admin/vendor-clientdesk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deleteTenant.id }),
            });
            const data = await res.json();

            if (!res.ok) {
                setDeleteError(data.error || data.message || t('vendor.deleteFailed'));
                return;
            }

            setDeleteTenant(null);
            setDeleteSuccess(formatDeleteSuccessMessage(lang, t('vendor.deleted'), data.unassignedAccounts));
            fetchTenants();
        } catch {
            setDeleteError('Connection error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const previewLogoUrl = resolveTenantAssetUrl(
        formLogoUrl,
        formDomain || editingTenant?.domain || null
    );
    const filteredTenants = tenants;

    const handleSectionSelect = (tab: ProductSubnavKey) => {
        const href = tab === 'users'
            ? '/admin/clientdesk'
            : tab === 'vendor'
                ? '/admin/clientdesk/vendor'
                : `/admin/clientdesk?tab=${tab}`;
        router.push(href);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                    <ClipboardIcon /> {t('clientdesk.title')}
                </h2>
                <p className="text-fg-muted text-sm mt-1">{t('clientdesk.desc')}</p>
            </div>

            <ProductSubnav
                activeKey="vendor"
                ariaLabel="Client Desk navigation"
                items={[
                    { key: 'users', label: 'Users', icon: ProductSubnavIcons.users },
                    { key: 'blocklist', label: 'Blocklist', icon: ProductSubnavIcons.blocklist },
                    { key: 'email-domains', label: 'Domain Email', icon: ProductSubnavIcons.emailDomains },
                    { key: 'maintenance', label: 'Maintenance', icon: ProductSubnavIcons.maintenance },
                    { key: 'vendor', label: 'Vendor', icon: ProductSubnavIcons.vendor },
                ]}
                onSelect={handleSectionSelect}
            />

            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                        <StoreIcon /> {t('vendor.manageTitle')}
                    </h2>
                    <p className="text-fg-muted text-sm mt-1">{t('vendorClientDesk.desc')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                            <SortIcon />
                        </span>
                        <select
                            value={sortMode}
                            onChange={(event) => setSortMode(event.target.value as VendorSortMode)}
                            className="h-9 pl-8 pr-3 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                        >
                            <option value="newest">{t('vendor.sortNewest')}</option>
                            <option value="oldest">{t('vendor.sortOldest')}</option>
                            <option value="alphabetical">{t('vendor.sortAlphabetical')}</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchTenants}
                        disabled={loading}
                        className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshIcon spinning={loading} /> {t('fastpik.refresh')}
                    </button>
                    <button
                        onClick={openCreate}
                        className="px-3 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <PlusIcon /> {t('vendor.newVendor')}
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('vendor.searchPlaceholder')}
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                />
            </div>

            {/* Vendor Count */}
            <div className="flex items-center gap-2 text-fg-muted text-sm">
                <GlobeIcon /> {t('vendor.totalVendors')}: <span className="font-semibold text-fg">{pagination.total}</span>
            </div>

            {/* Error */}
            {error && (
                <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                    {error}
                </div>
            )}

            {deleteSuccess && (
                <div className="text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 animate-fade-in">
                    {deleteSuccess}
                </div>
            )}

            {/* Loading */}
            {/* Tenants Grid */}
            {!loading && tenants.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                    {t('vendor.noVendors')}
                </div>
            ) : !loading && filteredTenants.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                    {t('vendor.noSearchResults')}
                </div>
            ) : (loading || filteredTenants.length > 0) && (<>
                <Pagination
                    meta={pagination}
                    loading={loading}
                    variant="navigation"
                    onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
                    onPageSizeChange={(pageSize: PageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border bg-bg-card p-5"><div className="skeleton h-10 w-10 rounded-lg" /><div className="skeleton mt-4 h-4 w-32" /><div className="skeleton mt-3 h-4 w-full" /><div className="skeleton mt-4 h-8 w-full" /></div>
                    )) : filteredTenants.map((tenant, i) => {
                        const tenantLogoUrl = resolveTenantAssetUrl(tenant.logo_url, tenant.domain);
                        return (
                            <div
                                key={tenant.id}
                                className={`bg-bg-card rounded-xl border ${tenant.is_active ? 'border-border' : 'border-danger/30 opacity-60'} p-5 shadow-[var(--shadow)] animate-fade-in hover:shadow-[var(--shadow-lg)] transition-all`}
                                style={{ animationDelay: `${i * 0.05}s` }}
                            >
                            {/* Tenant Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {tenantLogoUrl ? (
                                        <img src={tenantLogoUrl} alt={tenant.name} className="w-10 h-10 rounded-lg object-cover border border-border" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gray-500 dark:bg-gray-600">
                                            {tenant.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-fg text-sm">{tenant.name}</h3>
                                        <p className="text-fg-muted text-xs">@{tenant.slug}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tenant.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                                    {tenant.is_active ? '✓ Active' : '✗ Inactive'}
                                </span>
                            </div>

                            {/* Tenant Info */}
                            <div className="space-y-2 text-xs text-fg-muted mb-4">
                                {tenant.domain && (
                                    <div className="flex items-center gap-2">
                                        <GlobeIcon />
                                        <span className="truncate">{tenant.domain}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-fg-muted">{t('vendor.since')}:</span>
                                    <span>{formatDate(tenant.created_at)}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1.5 pt-3 border-t border-border-light">
                                <button
                                    onClick={() => openEdit(tenant)}
                                    className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-1"
                                >
                                    <EditIcon /> Edit
                                </button>
                                <button
                                    onClick={() => handleToggleActive(tenant)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all active:scale-95 ${tenant.is_active
                                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
                                        : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
                                        }`}
                                >
                                    {tenant.is_active ? t('vendor.deactivate') : t('vendor.activate')}
                                </button>
                                <button
                                    onClick={() => openDelete(tenant)}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-1"
                                >
                                    <TrashIcon /> {t('vendor.delete')}
                                </button>
                            </div>
                            </div>
                        );
                    })}
                </div>
                <Pagination meta={pagination} loading={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize: PageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />
            </>)}

            {/* Create/Edit Dialog */}
            <Dialog open={showForm} onClose={() => !formLoading && setShowForm(false)}>
                <h3 className="text-lg font-semibold text-fg mb-1">
                    {editingTenant ? t('vendor.editTitle') : t('vendor.createTitle')}
                </h3>
                <p className="text-fg-muted text-sm mb-5">
                    {editingTenant ? t('vendor.editDesc') : t('vendor.createDesc')}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-fg mb-1 block">Slug</label>
                            <input
                                value={formSlug}
                                readOnly
                                placeholder="auto-generated"
                                required
                                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formName')}</label>
                            <input
                                value={formName}
                                onChange={(e) => {
                                    const nextName = e.target.value;
                                    setFormName(nextName);
                                    if (!editingTenant) {
                                        setFormSlug(createVendorSlug(nextName));
                                    }
                                }}
                                placeholder="Ayu Studio Gallery"
                                required
                                className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formDomain')}</label>
                        <input
                            value={formDomain}
                            onChange={(e) => setFormDomain(e.target.value)}
                            placeholder="gallery.ayustudio.com"
                            className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <VendorAssetField
                        assetType="logo"
                        label={t('vendor.formLogo')}
                        url={formLogoUrl}
                        domain={formDomain || editingTenant?.domain || null}
                        file={formLogoFile}
                        disabled={formLoading}
                        onUrlChange={setFormLogoUrl}
                        onFileChange={setFormLogoFile}
                    />

                    <VendorAssetField
                        assetType="favicon"
                        label={t('vendor.formFavicon')}
                        url={formFaviconUrl}
                        domain={formDomain || editingTenant?.domain || null}
                        file={formFaviconFile}
                        disabled={formLoading}
                        onUrlChange={setFormFaviconUrl}
                        onFileChange={setFormFaviconFile}
                    />

                    <div>
                        <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formFooter')}</label>
                        <input
                            value={formFooter}
                            onChange={(e) => setFormFooter(e.target.value)}
                            placeholder="© 2026 Studio Name"
                            className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    {/* Preview */}
                    <div className="bg-bg rounded-xl border border-border p-4 mt-2">
                        <p className="text-xs text-fg-muted mb-2">{t('vendor.preview')}</p>
                        <div className="flex items-center gap-3">
                            {previewLogoUrl ? (
                                <img src={previewLogoUrl} alt="Preview" className="w-8 h-8 rounded-lg object-contain border border-border" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-gray-500 dark:bg-gray-600">
                                    {formName ? formName.charAt(0).toUpperCase() : '?'}
                                </div>
                            )}
                            <span className="font-semibold text-fg text-sm">{formName || 'Vendor Name'}</span>
                        </div>
                        {formFooter && (
                            <p className="text-xs text-fg-muted mt-2 pt-2 border-t border-border-light">{formFooter}</p>
                        )}
                    </div>

                    {formResult && (
                        <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${formResult.success ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-danger/10 text-danger'}`}>
                            {formResult.message}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 bg-bg border border-border rounded-xl text-sm text-fg cursor-pointer hover:bg-bg-secondary transition-all"
                        >
                            {t('dialog.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-2.5 bg-accent text-accent-fg rounded-xl text-sm font-semibold cursor-pointer hover:opacity-85 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {formLoading ? (
                                <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                            ) : (
                                editingTenant ? t('fastpik.save') : t('vendor.create')
                            )}
                        </button>
                    </div>
                </form>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deleteTenant} onClose={closeDelete}>
                <h3 className="text-lg font-semibold text-danger mb-2">{t('vendor.deleteTitle')}</h3>
                <p className="text-sm text-fg-muted mb-4">
                    {t('vendor.deleteDesc')}
                    {deleteTenant && (
                        <span className="block mt-2 text-fg font-medium">
                            {deleteTenant.name} (@{deleteTenant.slug})
                        </span>
                    )}
                    {deleteTenant?.domain && (
                        <span className="block mt-1 text-xs text-fg-muted">
                            {deleteTenant.domain}
                        </span>
                    )}
                </p>

                {deleteError && (
                    <div className="mb-4 px-4 py-2.5 rounded-lg text-sm bg-danger/10 text-danger animate-fade-in">
                        {deleteError}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeDelete}
                        disabled={deleteLoading}
                        className="px-4 py-2 bg-bg border border-border rounded-lg text-sm text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 disabled:opacity-60"
                    >
                        {t('dialog.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-red-700 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2"
                    >
                        {deleteLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {t('vendor.delete')}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}
