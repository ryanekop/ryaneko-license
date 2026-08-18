export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationMeta {
    page: number;
    pageSize: PageSize;
    total: number;
    totalPages: number;
}

export function parsePositiveInteger(value: string | null | undefined, fallback: number) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePageSize(value: string | null | undefined): PageSize {
    const parsed = Number.parseInt(value || '', 10);
    return PAGE_SIZE_OPTIONS.includes(parsed as PageSize)
        ? parsed as PageSize
        : DEFAULT_PAGE_SIZE;
}

export function createPagination(total: number, requestedPage: number, pageSize: PageSize): PaginationMeta {
    const safeTotal = Math.max(0, Math.floor(total || 0));
    const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
    const page = Math.min(Math.max(1, Math.floor(requestedPage || 1)), totalPages);
    return { page, pageSize, total: safeTotal, totalPages };
}

export function parseListParams(searchParams: URLSearchParams) {
    const pageSize = parsePageSize(searchParams.get('pageSize') || searchParams.get('limit'));
    const requestedPage = parsePositiveInteger(searchParams.get('page'), 1);
    return {
        requestedPage,
        pageSize,
        q: (searchParams.get('q') || searchParams.get('search') || '').trim(),
    };
}
