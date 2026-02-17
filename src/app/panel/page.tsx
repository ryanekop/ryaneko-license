'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme, useLang } from '@/lib/providers';

// --- ICONS (Same as AdminLayout) ---
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

const ArrowLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
);

const KeyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
);

const LogOutIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
);

const EXTERNAL_LINKS = [
    {
        name: 'Mayar.id',
        url: 'https://web.mayar.id/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=mayar.id&sz=128',
        color: 'text-blue-600',
        bg: 'bg-blue-600/5'
    },
    {
        name: 'Server Hostingan.id',
        url: 'https://my.hostingan.id/clientarea.php?action=productdetails&id=5733',
        iconUrl: 'https://www.google.com/s2/favicons?domain=hostingan.id&sz=128',
        color: 'text-orange-600',
        bg: 'bg-orange-600/5'
    },
    {
        name: 'Domainesia.com',
        url: 'https://my.domainesia.com/clientarea.php?action=domaindns',
        iconUrl: 'https://www.google.com/s2/favicons?domain=domainesia.com&sz=128',
        color: 'text-sky-600',
        bg: 'bg-sky-600/5'
    },
    {
        name: 'Supabase',
        url: 'https://supabase.com/dashboard/org/kseeljmrngtmvmkiexad',
        iconUrl: 'https://www.google.com/s2/favicons?domain=supabase.com&sz=128',
        color: 'text-emerald-600',
        bg: 'bg-emerald-600/5'
    },
    {
        name: 'Cloudflare Workers',
        url: 'https://dash.cloudflare.com/b2d74627e32503857472817ed109d920/workers-and-pages',
        iconUrl: 'https://www.google.com/s2/favicons?domain=cloudflare.com&sz=128',
        color: 'text-amber-600',
        bg: 'bg-amber-600/5'
    },
    {
        name: 'Pagespeed',
        url: 'https://pagespeed.web.dev/analysis/https-fastpik-ryanekoapp-web-id/bb7i7r83tf?form_factor=mobile',
        iconUrl: 'https://www.google.com/s2/favicons?domain=web.dev&sz=128',
        color: 'text-indigo-600',
        bg: 'bg-indigo-600/5'
    },
    {
        name: 'Analytics Umami',
        url: 'https://cloud.umami.is/analytics/us/websites/14ffd81f-07b2-4cc0-b72b-7b8aa4e864a0?path=eq.%2Fid%2Fclient%2Faloragraduation%2FAE8mr66C8Pky',
        iconUrl: 'https://www.google.com/s2/favicons?domain=umami.is&sz=128',
        color: 'text-pink-600',
        bg: 'bg-pink-600/5'
    },
    {
        name: 'Uptime Robot',
        url: 'https://dashboard.uptimerobot.com/monitors',
        iconUrl: 'https://www.google.com/s2/favicons?domain=uptimerobot.com&sz=128',
        color: 'text-green-600',
        bg: 'bg-green-600/5'
    }
];

export default function PanelPage() {
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem('admin_auth');
        if (saved === 'true') setIsAuthenticated(true);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
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
                setError(t('login.error'));
            }
        } catch {
            setError('Connection error');
        } finally {
            setLoginLoading(false);
        }
    };

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
                        <p className="text-fg-muted mt-1 text-sm">{t('panel.title')}</p>
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
                        {error && (
                            <div className="text-danger text-sm text-center animate-fade-in flex items-center justify-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
                                {error}
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

    return (
        <div className="min-h-screen bg-bg">
            <header className="bg-bg-card border-b border-border sticky top-0 z-50 shadow-[var(--shadow)]">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-fg">
                            <Link
                                href="/"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-fg-secondary cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                                title="Back to Home"
                            >
                                <ArrowLeftIcon />
                            </Link>
                            <KeyIcon />
                            <h1 className="text-base font-semibold tracking-tight">{t('panel.title')}</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleLang}
                                className="h-8 px-2.5 rounded-lg border border-border text-fg-secondary text-xs font-semibold cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                            >
                                {lang === 'id' ? 'EN' : 'ID'}
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-fg-secondary cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                            >
                                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                            </button>
                            <button
                                onClick={() => {
                                    sessionStorage.removeItem('admin_auth');
                                    setIsAuthenticated(false);
                                }}
                                className="ml-1 h-8 px-3 text-xs text-danger border border-border rounded-lg cursor-pointer hover:bg-danger/10 hover:border-danger/30 transition-all active:scale-95 flex items-center gap-1.5 font-medium"
                            >
                                <LogOutIcon /> {t('header.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 animate-fade-in">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold text-fg tracking-tight">{t('panel.title')}</h2>
                    <p className="text-fg-muted mt-2 max-w-lg mx-auto">{t('panel.desc')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {EXTERNAL_LINKS.map((link, index) => (
                        <a
                            key={link.name}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-card"
                            style={{ '--delay': `${index * 50}ms` } as any}
                        >
                            <div className="panel-card flex flex-col items-center text-center p-8 bg-bg-card border border-border rounded-2xl group">
                                <div className={`w-16 h-16 rounded-2xl ${link.bg} flex items-center justify-center mb-5`}>
                                    <img
                                        src={link.iconUrl}
                                        alt={link.name}
                                        className="w-10 h-10 object-contain rounded-lg"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(link.name)}&background=random&color=fff&size=128`;
                                        }}
                                    />
                                </div>
                                <h3 className="text-lg font-semibold text-fg mb-1 group-hover:text-accent" style={{ transition: 'color 0.3s ease' }}>
                                    {link.name}
                                </h3>
                                <p className="mt-2 text-xs font-medium text-fg-muted">
                                    Buka Dashboard →
                                </p>
                            </div>
                        </a>
                    ))}
                </div>
            </main>

            <style jsx global>{`
                @keyframes cardEntrance {
                    from {
                        opacity: 0;
                        transform: translateY(15px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .link-card {
                    opacity: 0;
                    animation: cardEntrance 0.6s ease-out forwards;
                    animation-delay: var(--delay);
                }

                .panel-card {
                    transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease !important;
                }

                .panel-card:hover {
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                    border-color: var(--accent, #3b82f6) / 0.2;
                    transform: translateY(-4px);
                }
            `}</style>
        </div>
    );
}
