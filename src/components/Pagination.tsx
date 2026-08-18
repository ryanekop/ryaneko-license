'use client';

import { PAGE_SIZE_OPTIONS, type PageSize, type PaginationMeta } from '@/lib/pagination';

export function Pagination({
    meta,
    loading,
    onPageChange,
    onPageSizeChange,
    variant = 'full',
}: {
    meta: PaginationMeta;
    loading?: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: PageSize) => void;
    variant?: 'full' | 'navigation';
}) {
    const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
    const to = Math.min(meta.total, meta.page * meta.pageSize);

    const navigation = (
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={loading || meta.page <= 1}
                onClick={() => onPageChange(meta.page - 1)}
                className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-fg-secondary transition-all hover:bg-bg-secondary active:scale-95 disabled:opacity-40"
            >
                Sebelumnya
            </button>
            <span className="min-w-[96px] text-center text-sm text-fg-secondary">{meta.page} / {meta.totalPages}</span>
            <button
                type="button"
                disabled={loading || meta.page >= meta.totalPages}
                onClick={() => onPageChange(meta.page + 1)}
                className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-fg-secondary transition-all hover:bg-bg-secondary active:scale-95 disabled:opacity-40"
            >
                Berikutnya
            </button>
        </div>
    );

    if (variant === 'navigation') {
        return <div className="flex justify-end">{navigation}</div>;
    }

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-fg-secondary">
                <span>Baris</span>
                <select
                    value={meta.pageSize}
                    disabled={loading}
                    onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
                    className="rounded-lg border border-border bg-bg-card px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                >
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>{from}–{to} dari {meta.total}</span>
            </div>
            {navigation}
        </div>
    );
}
