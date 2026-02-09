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
}

export default function LicenseList({ productSlug, productName }: LicenseListProps) {
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
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        ○ Available
                    </span>
                );
            case 'used':
                return (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        ● Used
                    </span>
                );
            case 'revoked':
                return (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                        ✕ Revoked
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
                    <h2 className="text-2xl font-bold text-white">{productName}</h2>
                    <p className="text-gray-400 text-sm">
                        Total: {total} | Available: {availableCount} | Used: {usedCount}
                    </p>
                </div>
                <button
                    onClick={fetchLicenses}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Search name, email, or serial..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    <option value="available">Available</option>
                    <option value="used">Used</option>
                    <option value="revoked">Revoked</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-gray-800/50 rounded-xl border border-gray-700">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                            <th className="px-4 py-3">Serial</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Device</th>
                            <th className="px-4 py-3">Activated</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                    Loading...
                                </td>
                            </tr>
                        ) : licenses.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                    No licenses found
                                </td>
                            </tr>
                        ) : (
                            licenses.map((license) => (
                                <tr key={license.id} className="text-white hover:bg-gray-700/30">
                                    <td className="px-4 py-3 font-mono text-sm text-orange-400">
                                        {license.serial_key.substring(0, 12)}...
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(license.status)}</td>
                                    <td className="px-4 py-3">{license.customer_name || '-'}</td>
                                    <td className="px-4 py-3 text-gray-400 text-sm">
                                        {license.customer_email || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{license.device_type || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-400">
                                        {formatDate(license.activated_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                                            Edit
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
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-400">
                        Page {page} of {Math.ceil(total / 50)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 50)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
