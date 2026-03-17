export function resolveTenantAssetUrl(
    assetUrl: string | null | undefined,
    domain: string | null | undefined
): string | null {
    if (!assetUrl) return null;

    const trimmedUrl = assetUrl.trim();
    if (!trimmedUrl) return null;

    if (
        /^https?:\/\//i.test(trimmedUrl) ||
        /^\/\//.test(trimmedUrl) ||
        /^data:/i.test(trimmedUrl)
    ) {
        return trimmedUrl;
    }

    if (!domain) return trimmedUrl;

    const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!cleanDomain) return trimmedUrl;

    const normalizedPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    return `https://${cleanDomain}${normalizedPath}`;
}
