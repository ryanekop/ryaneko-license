'use client';

import { useState, type ReactNode } from 'react';
import { useLang, useTheme } from '@/lib/providers';
import { useAdminSession } from '@/components/useAdminSession';

type AccessControls = Pick<ReturnType<typeof useAdminSession>, 'logout' | 'isLoggingOut' | 'logoutError'>;

export function AdminPasswordGate({ title, children }: { title: string; children: (controls: AccessControls) => ReactNode }) {
    const { isAuthenticated, authChecking, login, logout, isLoggingOut, logoutError } = useAdminSession();
    const { lang, toggleLang, t } = useLang();
    const { theme, toggleTheme } = useTheme();
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (authChecking) {
        return <div className="min-h-screen flex items-center justify-center bg-bg"><span className="w-5 h-5 border-2 border-fg-muted/30 border-t-fg rounded-full animate-spin" role="status" aria-label={t('login.loading')} /></div>;
    }
    if (isAuthenticated) return children({ logout, isLoggingOut, logoutError });

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg">
            <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={toggleTheme} aria-label={lang === 'id' ? 'Ganti tema' : 'Toggle theme'} className="h-9 px-3 rounded-lg border border-border text-fg-secondary text-xs">{theme === 'light' ? '☾' : '☀'}</button>
                <button onClick={toggleLang} aria-label={lang === 'id' ? 'Ganti bahasa' : 'Toggle language'} className="h-9 px-3 rounded-lg border border-border text-fg-secondary text-xs font-semibold">{lang === 'id' ? 'EN' : 'ID'}</button>
            </div>
            <div className="bg-bg-card p-8 rounded-2xl border border-border w-full max-w-sm mx-4 shadow-[var(--shadow-lg)] animate-fade-in-scale">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-fg">{title}</h1>
                    <p className="text-fg-muted mt-1 text-sm">{t('login.title')}</p>
                </div>
                <form className="space-y-4" onSubmit={async (event) => {
                    event.preventDefault();
                    setLoading(true);
                    setError('');
                    try {
                        if (await login(password, remember)) setPassword('');
                        else setError(t('login.error'));
                    } catch {
                        setError('Connection error');
                    } finally {
                        setLoading(false);
                    }
                }}>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('login.placeholder')} aria-label={t('login.placeholder')} autoComplete="current-password" disabled={loading} className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/20" />
                    <label className="flex items-center gap-2 text-sm text-fg-secondary">
                        <input type="checkbox" checked={showPassword} disabled={loading} onChange={(event) => setShowPassword(event.target.checked)} />
                        {lang === 'id' ? 'Tampilkan password' : 'Show password'}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-fg-secondary">
                        <input type="checkbox" checked={remember} disabled={loading} onChange={(event) => setRemember(event.target.checked)} />{t('login.remember')}
                    </label>
                    {error && <p role="alert" className="text-danger text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading || !password} className="w-full py-3 bg-accent text-accent-fg font-medium rounded-xl cursor-pointer disabled:opacity-50">{t(loading ? 'login.loading' : 'login.button')}</button>
                </form>
            </div>
        </div>
    );
}
