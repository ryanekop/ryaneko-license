export const VENDOR_SORT_MODES = ['newest', 'oldest', 'alphabetical'] as const;

export type VendorSortMode = (typeof VENDOR_SORT_MODES)[number];

export interface SortableVendor {
    id?: string | null;
    name?: string | null;
    created_at?: string | null;
}

export function parseVendorSortMode(value: string | null | undefined): VendorSortMode {
    return VENDOR_SORT_MODES.includes(value as VendorSortMode)
        ? value as VendorSortMode
        : 'newest';
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
    return (left || '').localeCompare(right || '', 'id', { sensitivity: 'base', numeric: true });
}

function dateValue(value: string | null | undefined) {
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortVendors<T extends SortableVendor>(vendors: T[], mode: VendorSortMode): T[] {
    return [...vendors].sort((left, right) => {
        if (mode !== 'alphabetical') {
            const difference = dateValue(left.created_at) - dateValue(right.created_at);
            if (difference !== 0) return mode === 'oldest' ? difference : -difference;
        }

        const nameDifference = compareText(left.name, right.name);
        if (nameDifference !== 0) return nameDifference;

        return compareText(left.id, right.id);
    });
}
