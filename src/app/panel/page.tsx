'use client';


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
        url: 'https://my.hostingan.id/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=hostingan.id&sz=128',
        color: 'text-orange-600',
        bg: 'bg-orange-600/5'
    },
    {
        name: 'Domainesia.com',
        url: 'https://my.domainesia.com/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=domainesia.com&sz=128',
        color: 'text-sky-600',
        bg: 'bg-sky-600/5'
    },
    {
        name: 'Supabase',
        url: 'https://supabase.com/dashboard/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=supabase.com&sz=128',
        color: 'text-emerald-600',
        bg: 'bg-emerald-600/5'
    },
    {
        name: 'Resend',
        url: 'https://resend.com/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=resend.com&sz=128',
        color: 'text-purple-600',
        bg: 'bg-purple-600/5'
    },
    {
        name: 'Cloudflare Workers',
        url: 'https://dash.cloudflare.com/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=cloudflare.com&sz=128',
        color: 'text-amber-600',
        bg: 'bg-amber-600/5'
    },
    {
        name: 'Pagespeed',
        url: 'https://pagespeed.web.dev/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=web.dev&sz=128',
        color: 'text-indigo-600',
        bg: 'bg-indigo-600/5'
    },
    {
        name: 'Analytics Umami',
        url: 'https://cloud.umami.is/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=umami.is&sz=128',
        color: 'text-pink-600',
        bg: 'bg-pink-600/5'
    },
    {
        name: 'Uptime Robot',
        url: 'https://dashboard.uptimerobot.com/',
        iconUrl: 'https://www.google.com/s2/favicons?domain=uptimerobot.com&sz=128',
        color: 'text-green-600',
        bg: 'bg-green-600/5'
    }
];

export default function PanelPage() {
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();

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
                            <h1 className="text-base font-normal tracking-tight">{t('panel.title')}</h1>
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

                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 animate-fade-in">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-normal text-fg tracking-tight">{t('panel.title')}</h2>
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
