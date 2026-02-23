'use client';

import { useState, useEffect } from 'react';
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

const KeyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const SettingsMenuIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const GridMenuIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
);

const SunIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
);

const MoonIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
);

export default function WebhookTestPage() {
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    const [jsonInput, setJsonInput] = useState(JSON.stringify(PRESETS[0].payload, null, 2));
    const [sending, setSending] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activePreset, setActivePreset] = useState(0);
    const [copied, setCopied] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem('admin_auth');
        if (saved === 'true') setIsAuthenticated(true);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setLoginLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                setIsAuthenticated(true);
                sessionStorage.setItem('admin_auth', 'true');
            } else {
                setLoginError(t('login.error'));
            }
        } catch {
            setLoginError('Connection error');
        } finally {
            setLoginLoading(false);
        }
    };

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg">
                <div className="absolute top-4 right-4 flex gap-2">
                    <button
                        onClick={toggleTheme}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-bg-card text-fg-secondary cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                    >
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                    <button
                        onClick={toggleLang}
                        className="h-9 px-3 rounded-lg border border-border bg-bg-card text-fg-secondary text-xs font-semibold cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                    >
                        {lang === 'id' ? 'EN' : 'ID'}
                    </button>
                </div>

                <div className="bg-bg-card p-8 rounded-2xl border border-border w-full max-w-sm mx-4 shadow-[var(--shadow-lg)] animate-fade-in-scale">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-3 text-fg animate-fade-in"><KeyIcon /></div>
                        <h1 className="text-2xl font-bold text-fg">{t('login.title')}</h1>
                        <p className="text-fg-muted mt-1 text-sm">{t('login.subtitle')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('login.placeholder')}
                                disabled={loginLoading}
                                className="w-full px-4 py-3 pr-11 bg-bg border border-border rounded-xl text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted cursor-pointer hover:text-fg transition-colors p-1"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                                )}
                            </button>
                        </div>
                        {loginError && (
                            <div className="text-danger text-sm text-center animate-fade-in flex items-center justify-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
                                {loginError}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loginLoading || !password}
                            className="w-full py-3 bg-accent text-accent-fg font-medium rounded-xl cursor-pointer hover:opacity-85 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loginLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                                    {t('login.loading')}
                                </>
                            ) : (
                                <>{t('login.button')}</>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

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
                <div style={{ flex: 1, position: 'relative' }}>
                    <button
                        onClick={() => setNavOpen(!navOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'inherit',
                        }}
                    >
                        <div>
                            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: 0, textAlign: 'left' }}>
                                Webhook Tester
                            </h1>
                            <p style={{ fontSize: '12px', color: 'var(--fg-muted)', margin: 0, textAlign: 'left' }}>
                                Unified Mayar Webhook — v2.0
                            </p>
                        </div>
                        <ChevronDownIcon />
                    </button>
                    {navOpen && (
                        <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setNavOpen(false)} />
                            <div className="animate-fade-in" style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '8px',
                                width: '224px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                boxShadow: 'var(--shadow-lg)',
                                zIndex: 50,
                                padding: '6px 0',
                            }}>
                                <Link
                                    href="/admin"
                                    onClick={() => setNavOpen(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 16px',
                                        fontSize: '14px',
                                        color: 'var(--fg)',
                                        textDecoration: 'none',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <SettingsMenuIcon /> {t('home.admin')}
                                </Link>
                                <Link
                                    href="/panel"
                                    onClick={() => setNavOpen(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 16px',
                                        fontSize: '14px',
                                        color: 'var(--fg)',
                                        textDecoration: 'none',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <GridMenuIcon /> {t('home.panel')}
                                </Link>
                            </div>
                        </>
                    )}
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

            {/* Footer: Webhook URL */}
            <div style={{
                marginTop: '24px',
                padding: '16px 20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                textAlign: 'center',
            }}>
                <p style={{ fontSize: '12px', color: 'var(--fg-muted)', marginBottom: '6px' }}>Mayar Webhook Endpoint</p>
                <code style={{
                    fontSize: '13px',
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-geist-mono), monospace',
                    background: 'var(--bg)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    userSelect: 'all',
                    cursor: 'text',
                }}>
                    https://license.ryanekoapp.web.id/api/mayar/webhook
                </code>
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
