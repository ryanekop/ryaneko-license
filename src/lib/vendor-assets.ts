export const VENDOR_ASSET_BUCKET = 'tenant-branding';
export const VENDOR_ASSET_RAW_MAX_BYTES = 10 * 1024 * 1024;

export type VendorProduct = 'fastpik' | 'clientdesk';
export type VendorAssetType = 'logo' | 'favicon';

export const VENDOR_ASSET_CONFIG: Record<VendorAssetType, { maxDimension: number; maxBytes: number }> = {
    logo: { maxDimension: 1600, maxBytes: 1024 * 1024 },
    favicon: { maxDimension: 512, maxBytes: 512 * 1024 },
};

export function parseVendorProduct(value: unknown): VendorProduct | null {
    return value === 'fastpik' || value === 'clientdesk' ? value : null;
}

export function parseVendorAssetType(value: unknown): VendorAssetType | null {
    return value === 'logo' || value === 'favicon' ? value : null;
}

export function parseVendorAssetSlug(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const slug = value.trim().toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export function buildVendorAssetPath(
    tenantSlug: string,
    assetType: VendorAssetType,
    uniqueId = crypto.randomUUID(),
    timestamp = Date.now(),
) {
    return `${tenantSlug}/${assetType}/${timestamp}-${uniqueId}.png`;
}

export function extractManagedVendorAssetPath(
    url: unknown,
    tenantSlug: string,
    expectedStorageOrigin: string,
): string | null {
    if (typeof url !== 'string' || !url.trim()) return null;

    try {
        const parsed = new URL(url);
        const expectedOrigin = new URL(expectedStorageOrigin).origin;
        if (parsed.origin !== expectedOrigin) return null;

        const marker = `/storage/v1/object/public/${VENDOR_ASSET_BUCKET}/`;
        const markerIndex = parsed.pathname.indexOf(marker);
        if (markerIndex < 0) return null;

        const objectPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
        const expectedPrefix = `${tenantSlug}/`;
        if (!objectPath.startsWith(expectedPrefix)) return null;

        const segments = objectPath.split('/');
        if (
            segments.length !== 3 ||
            segments[0] !== tenantSlug ||
            !parseVendorAssetType(segments[1]) ||
            !/^[a-zA-Z0-9-]+\.png$/.test(segments[2])
        ) {
            return null;
        }

        return objectPath;
    } catch {
        return null;
    }
}
