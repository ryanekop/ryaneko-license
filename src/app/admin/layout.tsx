'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme, useLang } from '@/lib/providers';

interface AdminLayoutProps {
    children: ReactNode;
}

// SVG Icons
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

const FolderIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
);

const UploadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
    </svg>
);

const ScissorsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />
    </svg>
);

const CameraIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
    </svg>
);

const GenerateIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
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

const WebhookMenuIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 16.98h1a2 2 0 0 0 1.83-2.83l-6-10.38a2 2 0 0 0-3.46 0l-6 10.38A2 2 0 0 0 7.17 17H8" /><circle cx="12" cy="17" r="1" /><path d="M12 12v4" />
    </svg>
);


const TAB_ICONS: Record<string, React.ReactNode> = {
    'raw-file-copy-tool': <FolderIcon />,
    'realtime-upload-pro': <UploadIcon />,
    'photo-split-express': <ScissorsIcon />,
    'fastpik': <CameraIcon />,
    'generate': <GenerateIcon />,
};

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();
    const [navOpen, setNavOpen] = useState(false);

    const TABS = [
        { name: t('tab.rawFileCopy'), href: '/admin/raw-file-copy', slug: 'raw-file-copy-tool' },
        { name: t('tab.realtimeUpload'), href: '/admin/realtime-upload', slug: 'realtime-upload-pro' },
        { name: t('tab.photoSplit'), href: '/admin/photo-split', slug: 'photo-split-express' },
        { name: t('tab.fastpik'), href: '/admin/fastpik', slug: 'fastpik' },
        { name: t('tab.generate'), href: '/admin/generate', slug: 'generate' },
    ];

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

    // Main admin layout
    return (
        <div className="min-h-screen bg-bg">
            <header className="bg-bg-card border-b border-border sticky top-0 z-50 shadow-[var(--shadow)]">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="relative flex items-center gap-2.5 text-fg">
                            <Link
                                href="/"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-fg-secondary cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
                                title="Back to Home"
                            >
                                <ArrowLeftIcon />
                            </Link>
                            <button
                                onClick={() => setNavOpen(!navOpen)}
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all"
                            >
                                <KeyIcon />
                                <h1 className="text-base font-semibold">{t('header.title')}</h1>
                                <ChevronDownIcon />
                            </button>
                            {navOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setNavOpen(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-bg-card border border-border rounded-xl shadow-[var(--shadow-lg)] z-50 py-1.5 animate-fade-in">
                                        <Link
                                            href="/panel"
                                            onClick={() => setNavOpen(false)}
                                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-fg hover:bg-bg-secondary"
                                        >
                                            <GridMenuIcon /> {t('home.panel')}
                                        </Link>
                                        <Link
                                            href="/webhook-test"
                                            onClick={() => setNavOpen(false)}
                                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-fg hover:bg-bg-secondary"
                                        >
                                            <WebhookMenuIcon /> {t('home.webhookTest')}
                                        </Link>
                                    </div>
                                </>
                            )}
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

            <div className="border-b border-border bg-bg-card">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                    <nav className="flex space-x-1 overflow-x-auto py-2">
                        {TABS.map((tab) => {
                            const isActive = pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.slug}
                                    href={tab.href}
                                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all cursor-pointer active:scale-[0.97] flex items-center gap-2 ${isActive
                                        ? 'bg-accent text-accent-fg font-medium shadow-[var(--shadow)]'
                                        : 'text-fg-secondary hover:text-fg hover:bg-bg-secondary'
                                        }`}
                                >
                                    {TAB_ICONS[tab.slug]}
                                    {tab.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
                {children}
            </main>
        </div>
    );
}
