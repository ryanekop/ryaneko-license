'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function LicenseList({ productSlug, productName, productEmoji = '📦' }: LicenseListProps) {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 text-emerald-400 border border-neutral-700">
                        🟢 Available
                    </span>
                );
            case 'used':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                        ⚪ Used
                    </span>
                );
            case 'revoked':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 text-red-400 border border-neutral-700">
                        🔴 Revoked
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span>{productEmoji}</span> {productName}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                        <span>📊 Total: {total}</span>
                        <span>🟢 Available: {availableCount}</span>
                        <span>⚪ Used: {usedCount}</span>
                    </div>
                </div>
                <button
                    onClick={fetchLicenses}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors border border-neutral-800 flex items-center gap-2 text-sm"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600">🔍</span>
                    <input
                        type="text"
                        placeholder="Search name, email, or serial..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-neutral-600 text-sm"
                >
                    <option value="all">All Status</option>
                    <option value="available">🟢 Available</option>
                    <option value="used">⚪ Used</option>
                    <option value="revoked">🔴 Revoked</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-neutral-900 rounded-xl border border-neutral-800">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-neutral-500 text-xs uppercase tracking-wider border-b border-neutral-800">
                            <th className="px-4 py-3">🔑 Serial</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">👤 Name</th>
                            <th className="px-4 py-3">📧 Email</th>
                            <th className="px-4 py-3">💻 Device</th>
                            <th className="px-4 py-3">📅 Activated</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                    ⏳ Loading...
                                </td>
                            </tr>
                        ) : licenses.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                    📭 No licenses found
                                </td>
                            </tr>
                        ) : (
                            licenses.map((license) => (
                                <tr key={license.id} className="text-white hover:bg-neutral-800/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-sm text-neutral-400">
                                        {license.serial_key.substring(0, 12)}...
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(license.status)}</td>
                                    <td className="px-4 py-3 text-sm">{license.customer_name || <span className="text-neutral-600">-</span>}</td>
                                    <td className="px-4 py-3 text-neutral-400 text-sm">
                                        {license.customer_email || <span className="text-neutral-600">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-neutral-400">{license.device_type || <span className="text-neutral-600">-</span>}</td>
                                    <td className="px-4 py-3 text-sm text-neutral-500">
                                        {formatDate(license.activated_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-colors border border-neutral-700">
                                            ✏️ Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 50 && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-white rounded-lg transition-colors border border-neutral-800 text-sm"
                    >
                        ← Previous
                    </button>
                    <span className="px-3 py-2 text-neutral-500 text-sm">
                        Page {page} of {Math.ceil(total / 50)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 50)}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-white rounded-lg transition-colors border border-neutral-800 text-sm"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
