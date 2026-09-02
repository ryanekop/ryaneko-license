import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildVendorAssetPath,
    extractManagedVendorAssetPath,
    parseVendorAssetSlug,
    parseVendorAssetType,
    parseVendorProduct,
    VENDOR_ASSET_BUCKET,
} from './vendor-assets.ts';

test('parses supported vendor asset inputs', () => {
    assert.equal(parseVendorProduct('fastpik'), 'fastpik');
    assert.equal(parseVendorProduct('clientdesk'), 'clientdesk');
    assert.equal(parseVendorProduct('other'), null);
    assert.equal(parseVendorAssetType('logo'), 'logo');
    assert.equal(parseVendorAssetType('favicon'), 'favicon');
    assert.equal(parseVendorAssetType('avatar'), null);
});

test('accepts only normalized safe tenant slugs', () => {
    assert.equal(parseVendorAssetSlug(' studio-ayu '), 'studio-ayu');
    assert.equal(parseVendorAssetSlug('../studio'), null);
    assert.equal(parseVendorAssetSlug('studio_ayu'), null);
    assert.equal(parseVendorAssetSlug(''), null);
});

test('builds a unique PNG object path under the tenant and asset type', () => {
    assert.equal(
        buildVendorAssetPath('studio-ayu', 'logo', 'asset-id', 1234),
        'studio-ayu/logo/1234-asset-id.png',
    );
});

test('extracts only managed URLs for the expected origin and tenant', () => {
    const origin = 'https://example.supabase.co';
    const managedUrl = `${origin}/storage/v1/object/public/${VENDOR_ASSET_BUCKET}/studio-ayu/logo/1234-asset-id.png`;

    assert.equal(
        extractManagedVendorAssetPath(managedUrl, 'studio-ayu', origin),
        'studio-ayu/logo/1234-asset-id.png',
    );
    assert.equal(extractManagedVendorAssetPath(managedUrl, 'other-studio', origin), null);
    assert.equal(extractManagedVendorAssetPath(managedUrl, 'studio-ayu', 'https://other.supabase.co'), null);
    assert.equal(extractManagedVendorAssetPath('https://cdn.example.com/logo.png', 'studio-ayu', origin), null);
    assert.equal(
        extractManagedVendorAssetPath(
            `${origin}/storage/v1/object/public/${VENDOR_ASSET_BUCKET}/studio-ayu/../../secret.png`,
            'studio-ayu',
            origin,
        ),
        null,
    );
});
