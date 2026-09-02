import sharp from 'sharp';
import { VENDOR_ASSET_CONFIG, type VendorAssetType } from './vendor-assets.ts';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export async function normalizeVendorImage(input: Buffer, assetType: VendorAssetType) {
    const config = VENDOR_ASSET_CONFIG[assetType];
    const source = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' });
    const metadata = await source.metadata();

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
        throw new Error('Only PNG, JPEG, and WebP images are allowed');
    }

    const sourceMaxDimension = Math.max(metadata.width || 1, metadata.height || 1);
    let targetDimension = Math.min(config.maxDimension, sourceMaxDimension);

    while (targetDimension >= 64) {
        const resizeOptions = assetType === 'favicon'
            ? {
                width: targetDimension,
                height: targetDimension,
                fit: 'cover' as const,
                position: 'centre' as const,
                withoutEnlargement: true,
            }
            : {
                width: targetDimension,
                height: targetDimension,
                fit: 'inside' as const,
                withoutEnlargement: true,
            };

        const output = await sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' })
            .rotate()
            .resize(resizeOptions)
            .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 7 })
            .toBuffer();

        if (output.byteLength <= config.maxBytes) return output;
        targetDimension = Math.floor(targetDimension * 0.82);
    }

    throw new Error(`${assetType === 'logo' ? 'Logo' : 'Favicon'} cannot be reduced to the allowed size`);
}
