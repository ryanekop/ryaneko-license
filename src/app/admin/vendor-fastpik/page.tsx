'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/providers';

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
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
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

// Portal Dialog component
function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open) return null;
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

const FASTPIK_API = process.env.NEXT_PUBLIC_FASTPIK_API_URL || 'https://fastpik.ryanekoapp.web.id';

export default function VendorFastpikPage() {
    const { t } = useLang();
    const [tenants, setTenants] = useState<TenantData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Create/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
    const [formSlug, setFormSlug] = useState('');
    const [formName, setFormName] = useState('');
    const [formDomain, setFormDomain] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [formFaviconUrl, setFormFaviconUrl] = useState('');

    const [formFooter, setFormFooter] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formResult, setFormResult] = useState<{ success: boolean; message: string } | null>(null);

    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('fastpik_admin_key') || '' : '';

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${FASTPIK_API}/api/admin/tenants`, {
                headers: { 'x-admin-api-key': apiKey },
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setTenants(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setLoading(false);
        }
    }, [apiKey]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    const openCreate = () => {
        setEditingTenant(null);
        setFormSlug('');
        setFormName('');
        setFormDomain('');
        setFormLogoUrl('');
        setFormFaviconUrl('');

        setFormFooter('');
        setFormResult(null);
        setShowForm(true);
    };

    const openEdit = (tenant: TenantData) => {
        setEditingTenant(tenant);
        setFormSlug(tenant.slug);
        setFormName(tenant.name);
        setFormDomain(tenant.domain || '');
        setFormLogoUrl(tenant.logo_url || '');
        setFormFaviconUrl(tenant.favicon_url || '');

        setFormFooter(tenant.footer_text || '');
        setFormResult(null);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormResult(null);
        try {
            const body = editingTenant
                ? { id: editingTenant.id, slug: formSlug, name: formName, domain: formDomain || null, logo_url: formLogoUrl || null, favicon_url: formFaviconUrl || null, footer_text: formFooter || null }
                : { slug: formSlug, name: formName, domain: formDomain || null, logo_url: formLogoUrl || null, favicon_url: formFaviconUrl || null, footer_text: formFooter || null };

            const res = await fetch(`${FASTPIK_API}/api/admin/tenants`, {
                method: editingTenant ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                setFormResult({ success: true, message: editingTenant ? t('vendor.updated') : t('vendor.created') });
                fetchTenants();
                setTimeout(() => setShowForm(false), 1000);
            } else {
                setFormResult({ success: false, message: data.error || 'Failed' });
            }
        } catch {
            setFormResult({ success: false, message: 'Connection error' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleActive = async (tenant: TenantData) => {
        try {
            await fetch(`${FASTPIK_API}/api/admin/tenants`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
                body: JSON.stringify({ id: tenant.id, is_active: !tenant.is_active }),
            });
            fetchTenants();
        } catch {
            alert('Connection error');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                        <StoreIcon /> {t('vendor.title')}
                    </h2>
                    <p className="text-fg-muted text-sm mt-1">{t('vendor.desc')}</p>
                </div>
                <div className="flex items-center gap-2">
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

            {/* API Key Setup */}
            {!apiKey && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm">
                    <p className="font-semibold text-amber-600 dark:text-amber-400 mb-2">⚠️ {t('vendor.apiKeyNeeded')}</p>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="ADMIN_API_KEY"
                            className="flex-1 px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    localStorage.setItem('fastpik_admin_key', input.value);
                                    window.location.reload();
                                }
                            }}
                        />
                        <button
                            onClick={() => {
                                const input = document.querySelector<HTMLInputElement>('input[placeholder="ADMIN_API_KEY"]');
                                if (input?.value) {
                                    localStorage.setItem('fastpik_admin_key', input.value);
                                    window.location.reload();
                                }
                            }}
                            className="px-4 py-2 bg-accent text-accent-fg rounded-xl text-sm font-medium cursor-pointer hover:opacity-85 transition-all"
                        >
                            {t('fastpik.save')}
                        </button>
                    </div>
                </div>
            )}

            {/* Vendor Count */}
            <div className="flex items-center gap-2 text-fg-muted text-sm">
                <GlobeIcon /> {t('vendor.totalVendors')}: <span className="font-semibold text-fg">{tenants.length}</span>
            </div>

            {/* Error */}
            {error && (
                <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && tenants.length === 0 && (
                <div className="flex items-center justify-center py-12">
                    <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
            )}

            {/* Tenants Grid */}
            {!loading && tenants.length === 0 && !error ? (
                <div className="text-center text-fg-muted py-12 bg-bg-card rounded-xl border border-border">
                    {t('vendor.noVendors')}
                </div>
            ) : tenants.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tenants.map((tenant, i) => (
                        <div
                            key={tenant.id}
                            className={`bg-bg-card rounded-xl border ${tenant.is_active ? 'border-border' : 'border-danger/30 opacity-60'} p-5 shadow-[var(--shadow)] animate-fade-in hover:shadow-[var(--shadow-lg)] transition-all`}
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            {/* Tenant Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {tenant.logo_url ? (
                                        <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-lg object-cover border border-border" />
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={showForm} onClose={() => setShowForm(false)}>
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
                                onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="vendor-name"
                                required
                                disabled={!!editingTenant}
                                className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formName')}</label>
                            <input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
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

                    <div>
                        <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formLogo')}</label>
                        <input
                            value={formLogoUrl}
                            onChange={(e) => setFormLogoUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-fg mb-1 block">{t('vendor.formFavicon')}</label>
                        <input
                            value={formFaviconUrl}
                            onChange={(e) => setFormFaviconUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

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
                            {formLogoUrl ? (
                                <img src={formLogoUrl} alt="Preview" className="w-8 h-8 rounded-lg object-cover border border-border" />
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
        </div>
    );
}
