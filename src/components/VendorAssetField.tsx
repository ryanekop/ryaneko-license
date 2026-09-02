'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { AdminModal } from '@/components/AdminModal';
import { useLang } from '@/lib/providers';
import { resolveTenantAssetUrl } from '@/lib/tenant-asset-url';
import { VENDOR_ASSET_RAW_MAX_BYTES, type VendorAssetType } from '@/lib/vendor-assets';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to read image'));
        image.src = source;
    });
}

async function cropFavicon(source: string, crop: Area) {
    const image = await loadImage(source);
    const outputSize = Math.min(512, Math.max(1, Math.round(Math.min(crop.width, crop.height))));
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not supported');

    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        outputSize,
        outputSize,
    );

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Failed to crop image')), 'image/png');
    });
}

interface VendorAssetFieldProps {
    assetType: VendorAssetType;
    label: string;
    url: string;
    domain: string | null;
    file: File | null;
    disabled?: boolean;
    onUrlChange: (value: string) => void;
    onFileChange: (file: File | null) => void;
}

export function VendorAssetField({
    assetType,
    label,
    url,
    domain,
    file,
    disabled,
    onUrlChange,
    onFileChange,
}: VendorAssetFieldProps) {
    const { t } = useLang();
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [cropSource, setCropSource] = useState<string | null>(null);
    const [cropPixels, setCropPixels] = useState<Area | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [processing, setProcessing] = useState(false);

    const filePreview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
    useEffect(() => () => {
        if (filePreview) URL.revokeObjectURL(filePreview);
    }, [filePreview]);

    const resolvedUrl = filePreview || resolveTenantAssetUrl(url, domain);

    const resetCrop = () => {
        setCropSource(null);
        setCropPixels(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setProcessing(false);
    };

    const acceptFile = (selectedFile: File) => {
        setError('');
        if (!ALLOWED_MIME_TYPES.has(selectedFile.type)) {
            setError(t('vendor.assetInvalidType'));
            return;
        }
        if (selectedFile.size > VENDOR_ASSET_RAW_MAX_BYTES) {
            setError(t('vendor.assetTooLarge'));
            return;
        }

        if (assetType === 'logo') {
            onUrlChange('');
            onFileChange(selectedFile);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setCropSource(String(reader.result || ''));
        reader.onerror = () => setError(t('vendor.assetReadFailed'));
        reader.readAsDataURL(selectedFile);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        event.target.value = '';
        if (selectedFile) acceptFile(selectedFile);
    };

    const applyCrop = async () => {
        if (!cropSource || !cropPixels) return;
        setProcessing(true);
        setError('');
        try {
            const blob = await cropFavicon(cropSource, cropPixels);
            onUrlChange('');
            onFileChange(new File([blob], `favicon-${Date.now()}.png`, { type: 'image/png' }));
            resetCrop();
        } catch {
            setError(t('vendor.assetProcessFailed'));
            setProcessing(false);
        }
    };

    return (
        <div>
            <label className="text-xs font-medium text-fg mb-1 block">{label}</label>
            <div className="flex items-start gap-3">
                <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-bg-secondary flex items-center justify-center ${assetType === 'favicon' ? 'p-2' : 'p-1'}`}>
                    {resolvedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Preview supports object URLs, data URLs, relative tenant assets, and arbitrary external URLs.
                        <img
                            src={resolvedUrl}
                            alt={`${label} preview`}
                            className={`h-full w-full ${assetType === 'logo' ? 'object-contain' : 'object-cover rounded-md'}`}
                        />
                    ) : (
                        <span className="text-[10px] text-fg-muted text-center">{t('vendor.assetNoImage')}</span>
                    )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => inputRef.current?.click()}
                            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs font-medium text-fg hover:bg-bg disabled:opacity-50"
                        >
                            {file ? t('vendor.assetChange') : t('vendor.assetUpload')}
                        </button>
                        {(file || url) && (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => { onFileChange(null); onUrlChange(''); setError(''); }}
                                className="px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                            >
                                {t('vendor.assetRemove')}
                            </button>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={disabled}
                        onChange={handleInputChange}
                    />
                    {file && <p className="truncate text-[11px] text-fg-muted">{file.name}</p>}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-fg-muted">{t('vendor.assetOrUrl')}</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    <input
                        value={url}
                        disabled={disabled}
                        onChange={(event) => {
                            onFileChange(null);
                            onUrlChange(event.target.value);
                            setError('');
                        }}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-fg text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                </div>
            </div>
            <p className="mt-1.5 text-[11px] text-fg-muted">
                {assetType === 'logo' ? t('vendor.logoUploadHint') : t('vendor.faviconUploadHint')}
            </p>
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}

            <AdminModal open={Boolean(cropSource)} onClose={() => !processing && resetCrop()} className="max-w-lg">
                <h3 className="text-lg font-semibold text-fg mb-1">{t('vendor.faviconCropTitle')}</h3>
                <p className="text-sm text-fg-muted mb-4">{t('vendor.faviconCropDesc')}</p>
                <div className="relative h-72 overflow-hidden rounded-xl bg-black/80">
                    {cropSource && (
                        <Cropper
                            image={cropSource}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="rect"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setCropPixels(pixels)}
                        />
                    )}
                </div>
                <div className="flex items-center gap-3 py-4">
                    <span className="text-xs text-fg-muted">−</span>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={zoom}
                        onChange={(event) => setZoom(Number(event.target.value))}
                        className="flex-1 accent-accent"
                    />
                    <span className="text-xs text-fg-muted">+</span>
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" disabled={processing} onClick={resetCrop} className="px-4 py-2 bg-bg border border-border rounded-xl text-sm text-fg disabled:opacity-50">
                        {t('dialog.cancel')}
                    </button>
                    <button type="button" disabled={processing || !cropPixels} onClick={applyCrop} className="px-4 py-2 bg-accent text-accent-fg rounded-xl text-sm font-semibold disabled:opacity-50">
                        {processing ? t('vendor.assetProcessing') : t('vendor.assetUse')}
                    </button>
                </div>
            </AdminModal>
        </div>
    );
}
