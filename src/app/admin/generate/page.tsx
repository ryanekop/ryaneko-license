'use client';

import { useState } from 'react';
import { useLang } from '@/lib/providers';

const PRODUCTS = [
    { slug: 'raw-file-copy-tool', name: 'RAW File Copy Tool' },
    { slug: 'realtime-upload-pro', name: 'Realtime Upload Pro' },
    { slug: 'photo-split-express', name: 'Photo Split Express' },
];

const COUNT_OPTIONS = [1, 5, 10, 20, 50, 100];

// SVG Icons
const KeyIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
);

const SparklesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
);

interface GeneratedSerial {
    serial_key: string;
    serial_hash: string;
}

export default function GeneratePage() {
    const { t } = useLang();
    const [selectedProduct, setSelectedProduct] = useState('');
    const [count, setCount] = useState(10);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        product: string;
        batchId: string;
        count: number;
        serials: GeneratedSerial[];
    } | null>(null);
    const [error, setError] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const handleGenerate = async () => {
        if (!selectedProduct) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch('/api/admin/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productSlug: selectedProduct, count }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to generate');
                return;
            }

            setResult(data);
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, index: number) => {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const copyAllSerials = async () => {
        if (!result) return;
        const text = result.serials.map(s => s.serial_key).join('\n');
        await navigator.clipboard.writeText(text);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const copyAllWithHash = async () => {
        if (!result) return;
        const lines = result.serials.map(s => `${s.serial_key}\t${s.serial_hash}`);
        const text = `Serial Key\tSHA256 Hash\n${lines.join('\n')}`;
        await navigator.clipboard.writeText(text);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const downloadCSV = () => {
        if (!result) return;
        const header = 'Serial Key,SHA256 Hash';
        const rows = result.serials.map(s => `${s.serial_key},${s.serial_hash}`);
        const csv = `${header}\n${rows.join('\n')}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `serials-${result.batchId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2.5">
                    <KeyIcon /> {t('generate.title')}
                </h2>
                <p className="text-fg-muted text-sm mt-2">{t('generate.desc')}</p>
            </div>

            {/* Generator Form */}
            <div className="bg-bg-card rounded-xl border border-border p-5 sm:p-6 shadow-[var(--shadow)] space-y-5 animate-slide-up">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Product Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-fg">{t('generate.product')}</label>
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 text-sm cursor-pointer transition-all hover:bg-bg-secondary"
                        >
                            <option value="">{t('generate.selectProduct')}</option>
                            {PRODUCTS.map(p => (
                                <option key={p.slug} value={p.slug}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Count Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-fg">{t('generate.count')}</label>
                        <select
                            value={count}
                            onChange={(e) => setCount(parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 text-sm cursor-pointer transition-all hover:bg-bg-secondary"
                        >
                            {COUNT_OPTIONS.map(n => (
                                <option key={n} value={n}>{n} serial</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={!selectedProduct || loading}
                    className="w-full sm:w-auto px-6 py-3 bg-accent text-accent-fg font-semibold rounded-xl cursor-pointer hover:opacity-85 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[var(--shadow)]"
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                            {t('generate.generating')}
                        </>
                    ) : (
                        <>
                            <SparklesIcon /> {t('generate.button')}
                        </>
                    )}
                </button>

                {error && (
                    <div className="text-danger text-sm bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 animate-fade-in">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-4 animate-slide-up">
                    {/* Result Header */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                {t('generate.success')}
                            </p>
                            <p className="text-fg-muted text-xs mt-0.5">
                                {result.product} · {result.count} serial · {result.batchId}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={copyAllSerials}
                                className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                {copiedAll ? <CheckIcon /> : <CopyIcon />}
                                {copiedAll ? t('generate.copied') : t('generate.copyAll')}
                            </button>
                            <button
                                onClick={copyAllWithHash}
                                className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <CopyIcon /> {t('generate.copyHash')}
                            </button>
                            <button
                                onClick={downloadCSV}
                                className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs font-medium text-fg cursor-pointer hover:bg-bg-secondary transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <DownloadIcon /> CSV
                            </button>
                        </div>
                    </div>

                    {/* Serial Table */}
                    <div className="overflow-auto max-h-[calc(100vh-400px)] bg-bg-card rounded-xl border border-border shadow-[var(--shadow)]">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-bg-card z-10 border-b border-border">
                                <tr className="text-left text-fg-muted text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium w-12">No.</th>
                                    <th className="px-4 py-3 font-medium">{t('generate.serialKey')}</th>
                                    <th className="px-4 py-3 font-medium">{t('generate.sha256')}</th>
                                    <th className="px-4 py-3 font-medium w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light">
                                {result.serials.map((serial, index) => (
                                    <tr
                                        key={serial.serial_key}
                                        className="table-row text-fg hover:bg-bg-secondary/50 transition-colors"
                                        style={{ animationDelay: `${index * 0.02}s` }}
                                    >
                                        <td className="px-4 py-2.5 text-sm text-fg-muted">{index + 1}</td>
                                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-fg">{serial.serial_key}</td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-fg-muted break-all">{serial.serial_hash}</td>
                                        <td className="px-4 py-2.5">
                                            <button
                                                onClick={() => copyToClipboard(serial.serial_key, index)}
                                                className="p-1.5 text-fg-muted cursor-pointer hover:text-fg hover:bg-bg-secondary rounded-lg transition-all active:scale-90"
                                                title="Copy serial"
                                            >
                                                {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
