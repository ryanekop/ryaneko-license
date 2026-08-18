import { createPagination, type PageSize, type PaginationMeta } from './pagination.ts';
import { sortVendors, type SortableVendor, type VendorSortMode } from './vendor-sort.ts';

export interface VendorListItem extends SortableVendor {
    id: string;
    name: string;
    slug?: string | null;
    domain?: string | null;
}

interface UpstreamPagination {
    totalPages?: unknown;
}

interface UpstreamVendorPage {
    items?: unknown;
    pagination?: UpstreamPagination | null;
}

export interface VendorListResult<T> {
    items: T[];
    pagination: PaginationMeta;
}

const UPSTREAM_PAGE_SIZE = 100;
const MAX_UPSTREAM_PAGES = 1000;

function parseTotalPages(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function assertVendorItems<T extends VendorListItem>(value: unknown): T[] {
    if (!Array.isArray(value)) throw new Error('Malformed vendor list response');
    return value as T[];
}

export async function fetchAllVendorPages<T extends VendorListItem>(
    fetchPage: (page: number, pageSize: number) => Promise<unknown>,
    upstreamPageSize = UPSTREAM_PAGE_SIZE,
): Promise<T[]> {
    const vendors: T[] = [];
    const seenIds = new Set<string>();
    let page = 1;
    let totalPages: number | null = null;

    while (page <= MAX_UPSTREAM_PAGES) {
        const payload = await fetchPage(page, upstreamPageSize);

        if (Array.isArray(payload)) {
            if (page !== 1) throw new Error('Malformed vendor list response');
            return assertVendorItems<T>(payload);
        }

        if (!payload || typeof payload !== 'object') {
            throw new Error('Malformed vendor list response');
        }

        const upstreamPage = payload as UpstreamVendorPage;
        const items = assertVendorItems<T>(upstreamPage.items);
        const reportedTotalPages = parseTotalPages(upstreamPage.pagination?.totalPages);
        if (reportedTotalPages !== null) totalPages = reportedTotalPages;

        if (items.length === 0) {
            if (totalPages !== null && page < totalPages) {
                throw new Error('Upstream vendor pagination ended early');
            }
            return vendors;
        }

        for (const item of items) {
            if (!item.id || seenIds.has(item.id)) {
                throw new Error('Upstream vendor pagination repeated an item');
            }
            seenIds.add(item.id);
            vendors.push(item);
        }

        if (totalPages !== null) {
            if (page >= totalPages) return vendors;
        }

        page += 1;
    }

    throw new Error('Upstream vendor pagination exceeded the safety limit');
}

export function createVendorListResult<T extends VendorListItem>(
    vendors: T[],
    options: {
        requestedPage: number;
        pageSize: PageSize;
        q: string;
        sort: VendorSortMode;
    },
): VendorListResult<T> {
    const needle = options.q.toLocaleLowerCase('id');
    const filtered = needle
        ? vendors.filter((vendor) =>
            `${vendor.name || ''} ${vendor.slug || ''} ${vendor.domain || ''}`
                .toLocaleLowerCase('id')
                .includes(needle))
        : vendors;
    const sorted = sortVendors(filtered, options.sort);
    const pagination = createPagination(sorted.length, options.requestedPage, options.pageSize);
    const offset = (pagination.page - 1) * pagination.pageSize;

    return {
        items: sorted.slice(offset, offset + pagination.pageSize),
        pagination,
    };
}
