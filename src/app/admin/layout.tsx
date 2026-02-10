'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme, useLang } from '@/lib/providers';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();

    const TABS = [
        { name: t('tab.rawFileCopy'), href: '/admin/raw-file-copy', slug: 'raw-file-copy-tool' },
        { name: t('tab.realtimeUpload'), href: '/admin/realtime-upload', slug: 'realtime-upload-pro' },
        { name: t('tab.photoSplit'), href: '/admin/photo-split', slug: 'photo-split-express' },
        { name: t('tab.fastpik'), href: '/admin/fastpik', slug: 'fastpik' },
    ];

    useEffect(() => {
        const saved = sessionStorage.getItem('admin_auth');
        if (saved === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoginLoading(true);

        // Simulate minimum loading time for UX
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
                {/* Theme/Lang toggles */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg border border-border bg-bg-card hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    <button
                        onClick={toggleLang}
                        className="px-3 py-2 rounded-lg border border-border bg-bg-card text-fg-secondary text-xs font-medium hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
                    >
                        {lang === 'id' ? '🇬🇧 EN' : '🇮🇩 ID'}
                    </button>
                </div>

                <div className="bg-bg-card p-8 rounded-2xl border border-border w-full max-w-sm mx-4 shadow-[var(--shadow-lg)] animate-fade-in-scale">
                    <div className="text-center mb-8">
                        <div className="text-5xl mb-3 animate-fade-in">🔑</div>
                        <h1 className="text-2xl font-bold text-fg">
                            {t('login.title')}
                        </h1>
                        <p className="text-fg-muted mt-1 text-sm">{t('login.subtitle')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('login.placeholder')}
                                disabled={loginLoading}
                                className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all disabled:opacity-50"
                            />
                        </div>
                        {error && (
                            <div className="text-danger text-sm text-center animate-fade-in flex items-center justify-center gap-1">
                                <span>⚠️</span> {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loginLoading || !password}
                            className="w-full py-3 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                        >
                            {loginLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
                                    {t('login.loading')}
                                </>
                            ) : (
                                <>{t('login.button')} →</>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg">
            {/* Header */}
            <header className="bg-bg-card border-b border-border sticky top-0 z-50 shadow-[var(--shadow)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl">🔑</span>
                            <h1 className="text-base font-semibold text-fg">
                                {t('header.title')}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleLang}
                                className="px-2.5 py-1.5 rounded-lg border border-border text-fg-secondary text-xs font-medium hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
                            >
                                {lang === 'id' ? '🇬🇧 EN' : '🇮🇩 ID'}
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="p-1.5 rounded-lg border border-border hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
                            >
                                {theme === 'light' ? '🌙' : '☀️'}
                            </button>
                            <button
                                onClick={() => {
                                    sessionStorage.removeItem('admin_auth');
                                    setIsAuthenticated(false);
                                }}
                                className="ml-1 px-3 py-1.5 text-xs text-danger border border-border rounded-lg hover:bg-danger/10 hover:border-danger/30 transition-all hover:scale-105 active:scale-95"
                            >
                                {t('header.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-border bg-bg-card">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <nav className="flex space-x-1 overflow-x-auto py-2">
                        {TABS.map((tab) => {
                            const isActive = pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.slug}
                                    href={tab.href}
                                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all hover:scale-[1.02] active:scale-[0.98] ${isActive
                                            ? 'bg-accent text-accent-fg font-medium shadow-[var(--shadow)]'
                                            : 'text-fg-secondary hover:text-fg hover:bg-bg-secondary'
                                        }`}
                                >
                                    {tab.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
                {children}
            </main>
        </div>
    );
}
