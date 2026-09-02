import type { VendorAssetType, VendorProduct } from '@/lib/vendor-assets';

export async function uploadVendorAsset(options: {
    product: VendorProduct;
    tenantSlug: string;
    assetType: VendorAssetType;
    file: File;
}) {
    const formData = new FormData();
    formData.append('product', options.product);
    formData.append('tenantSlug', options.tenantSlug);
    formData.append('assetType', options.assetType);
    formData.append('file', options.file);

    const response = await fetch('/api/admin/vendor-assets', { method: 'POST', body: formData });
    const payload = await response.json().catch(() => null) as { url?: string; objectPath?: string; error?: string } | null;

    if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || 'Failed to upload vendor image');
    }

    return { url: payload.url, objectPath: payload.objectPath || '' };
}

export async function cleanupVendorAssets(options: {
    product: VendorProduct;
    tenantSlug: string;
    urls: Array<string | null | undefined>;
}) {
    const urls = options.urls.filter((url): url is string => Boolean(url));
    if (urls.length === 0) return;

    try {
        await fetch('/api/admin/vendor-assets', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: options.product, tenantSlug: options.tenantSlug, urls }),
        });
    } catch {
        // Cleanup is best effort; never replace the original save/upload result.
    }
}
