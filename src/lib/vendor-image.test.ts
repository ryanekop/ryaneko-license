import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { normalizeVendorImage } from './vendor-image.ts';
import { VENDOR_ASSET_CONFIG } from './vendor-assets.ts';

test('resizes a transparent landscape logo without changing its ratio', async () => {
    const input = await sharp({
        create: { width: 3200, height: 800, channels: 4, background: { r: 20, g: 120, b: 220, alpha: 0.5 } },
    }).png().toBuffer();

    const output = await normalizeVendorImage(input, 'logo');
    const metadata = await sharp(output).metadata();

    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 400);
    assert.equal(metadata.hasAlpha, true);
    assert.ok(output.byteLength <= VENDOR_ASSET_CONFIG.logo.maxBytes);
});

test('crops and resizes favicon output to a square', async () => {
    const input = await sharp({
        create: { width: 1200, height: 800, channels: 3, background: { r: 240, g: 80, b: 40 } },
    }).jpeg().toBuffer();

    const output = await normalizeVendorImage(input, 'favicon');
    const metadata = await sharp(output).metadata();

    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.ok(output.byteLength <= VENDOR_ASSET_CONFIG.favicon.maxBytes);
});

test('rejects unsupported image formats', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await assert.rejects(() => normalizeVendorImage(svg, 'logo'), /Only PNG, JPEG, and WebP/);
});
