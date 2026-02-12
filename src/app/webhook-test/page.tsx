'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme, useLang } from '@/lib/providers';

const PRESETS = [
    {
        label: 'Fastpik Pro Monthly',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-FPK-${Date.now()}`,
                productName: 'Fastpik Pro Monthly',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 15000,
            },
        },
    },
    {
        label: 'Fastpik Pro Quarterly',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-FPK-${Date.now()}`,
                productName: 'Fastpik Pro Quarterly',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 39000,
            },
        },
    },
    {
        label: 'Fastpik Pro Yearly',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-FPK-${Date.now()}`,
                productName: 'Fastpik Pro Yearly',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 129000,
            },
        },
    },
    {
        label: 'Fastpik Lifetime',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-FPK-${Date.now()}`,
                productName: 'Fastpik Lifetime',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 349000,
            },
        },
    },
    {
        label: 'Realtime Upload Pro',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-RU-${Date.now()}`,
                productName: 'Realtime Upload Pro',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 99000,
            },
        },
    },
    {
        label: 'RAW File Copy Tool',
        payload: {
            event: 'payment.received',
            data: {
                id: `TEST-RFC-${Date.now()}`,
                productName: 'RAW File Copy Tool',
                customerName: 'Test User',
                customerEmail: 'test@example.com',
                status: true,
                amount: 149000,
            },
        },
    },
    {
        label: 'Test Event (ping)',
        payload: {
            event: 'testing',
            data: {},
        },
    },
];

interface LogEntry {
    time: string;
    type: 'request' | 'success' | 'error';
    message: string;
    details?: string;
}

const ArrowLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
);

const SendIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const XIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

export default function WebhookTestPage() {
    const { theme } = useTheme();
    const { t } = useLang();

    const [jsonInput, setJsonInput] = useState(JSON.stringify(PRESETS[0].payload, null, 2));
    const [sending, setSending] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activePreset, setActivePreset] = useState(0);
    const [copied, setCopied] = useState(false);

    const addLog = (type: LogEntry['type'], message: string, details?: string) => {
        const time = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [{ time, type, message, details }, ...prev]);
    };

    const handlePreset = (index: number) => {
        // Generate fresh ID each time
        const preset = { ...PRESETS[index] };
        const payload = JSON.parse(JSON.stringify(preset.payload));
        if (payload.data?.id) {
            payload.data.id = `TEST-${Date.now()}`;
        }
        setJsonInput(JSON.stringify(payload, null, 2));
        setActivePreset(index);
    };

    const handleSend = async () => {
        setSending(true);
        try {
            const parsed = JSON.parse(jsonInput);
            addLog('request', `POST /api/mayar/webhook`, JSON.stringify(parsed, null, 2));

            const res = await fetch('/api/mayar/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });

            const result = await res.json();

            if (res.ok) {
                addLog('success', `${res.status} — ${result.message || result.status}`, JSON.stringify(result, null, 2));
            } else {
                addLog('error', `${res.status} — ${result.message || 'Error'}`, JSON.stringify(result, null, 2));
            }
        } catch (err: any) {
            addLog('error', `Parse/Network Error: ${err.message}`);
        }
        setSending(false);
    };

    const handleCopyPayload = async () => {
        await navigator.clipboard.writeText(jsonInput);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const getPresetColor = (label: string) => {
        if (label.includes('Fastpik')) return 'var(--accent)';
        if (label.includes('Realtime') || label.includes('RAW') || label.includes('Photo Split')) return '#10b981';
        return 'var(--fg-muted)';
    };

    return (
        <div className="min-h-screen bg-bg">
            {/* Header */}
            <div style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-card)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backdropFilter: 'blur(12px)',
            }}>
                <Link
                    href="/"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--fg-secondary)',
                        textDecoration: 'none',
                        fontSize: '14px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        transition: 'all 0.15s',
                    }}
                >
                    <ArrowLeftIcon />
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
                        Webhook Tester
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--fg-muted)', margin: 0 }}>
                        Unified Mayar Webhook — v2.0
                    </p>
                </div>
                <div style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontWeight: 600,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                }}>
                    ● LIVE
                </div>
            </div>

            <div style={{
                maxWidth: '960px',
                margin: '0 auto',
                padding: '24px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
            }}>
                {/* Left Column — Payload Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Presets */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '16px',
                    }}>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--fg-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '10px',
                        }}>
                            Presets
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {PRESETS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handlePreset(i)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '8px',
                                        border: activePreset === i
                                            ? `1.5px solid ${getPresetColor(preset.label)}`
                                            : '1px solid var(--border)',
                                        background: activePreset === i
                                            ? `color-mix(in srgb, ${getPresetColor(preset.label)} 10%, transparent)`
                                            : 'var(--bg)',
                                        color: activePreset === i ? getPresetColor(preset.label) : 'var(--fg-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* JSON Editor */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 16px',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <span style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--fg-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                Payload (JSON)
                            </span>
                            <button
                                onClick={handleCopyPayload}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg)',
                                    color: copied ? '#10b981' : 'var(--fg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                            </button>
                        </div>
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            spellCheck={false}
                            style={{
                                flex: 1,
                                minHeight: '300px',
                                padding: '16px',
                                fontFamily: 'var(--font-geist-mono), monospace',
                                fontSize: '12px',
                                lineHeight: '1.6',
                                color: 'var(--fg)',
                                background: 'var(--bg)',
                                border: 'none',
                                outline: 'none',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '14px',
                            fontSize: '14px',
                            fontWeight: 600,
                            borderRadius: '12px',
                            border: 'none',
                            background: sending
                                ? 'var(--fg-muted)'
                                : 'var(--accent)',
                            color: 'var(--accent-fg)',
                            cursor: sending ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: sending ? 0.7 : 1,
                        }}
                    >
                        <SendIcon />
                        {sending ? 'Sending...' : 'Send Webhook'}
                    </button>
                </div>

                {/* Right Column — Response Logs */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--fg-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Response Log ({logs.length})
                        </span>
                        {logs.length > 0 && (
                            <button
                                onClick={() => setLogs([])}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg)',
                                    color: 'var(--fg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <TrashIcon /> Clear
                            </button>
                        )}
                    </div>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px',
                        maxHeight: 'calc(100vh - 200px)',
                    }}>
                        {logs.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: 'var(--fg-muted)',
                                fontSize: '13px',
                            }}>
                                No logs yet. Send a webhook to see results.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {logs.map((log, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: `1px solid ${log.type === 'success'
                                                ? 'rgba(16, 185, 129, 0.2)'
                                                : log.type === 'error'
                                                    ? 'rgba(239, 68, 68, 0.2)'
                                                    : 'var(--border)'
                                                }`,
                                            background: log.type === 'success'
                                                ? 'rgba(16, 185, 129, 0.05)'
                                                : log.type === 'error'
                                                    ? 'rgba(239, 68, 68, 0.05)'
                                                    : 'var(--bg)',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: log.details ? '8px' : 0,
                                        }}>
                                            <span style={{
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                background: log.type === 'success'
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : log.type === 'error'
                                                        ? 'rgba(239, 68, 68, 0.15)'
                                                        : 'rgba(99, 102, 241, 0.15)',
                                                color: log.type === 'success'
                                                    ? '#10b981'
                                                    : log.type === 'error'
                                                        ? '#ef4444'
                                                        : '#6366f1',
                                            }}>
                                                {log.type === 'success' ? <CheckIcon /> : log.type === 'error' ? <XIcon /> : <SendIcon />}
                                            </span>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: 'var(--fg)',
                                                flex: 1,
                                            }}>
                                                {log.message}
                                            </span>
                                            <span style={{
                                                fontSize: '10px',
                                                color: 'var(--fg-muted)',
                                                fontFamily: 'var(--font-geist-mono), monospace',
                                            }}>
                                                {log.time}
                                            </span>
                                        </div>
                                        {log.details && (
                                            <pre style={{
                                                fontSize: '11px',
                                                lineHeight: '1.5',
                                                color: 'var(--fg-secondary)',
                                                fontFamily: 'var(--font-geist-mono), monospace',
                                                background: 'var(--bg)',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                overflow: 'auto',
                                                maxHeight: '200px',
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}>
                                                {log.details}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile: stack columns */}
            <style>{`
                @media (max-width: 768px) {
                    div[style*="gridTemplateColumns"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
