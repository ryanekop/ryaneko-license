'use client';

import Link from 'next/link';
import { useTheme, useLang } from '@/lib/providers';

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

const KeyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const WebhookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.98h1a2 2 0 0 0 1.83-2.83l-6-10.38a2 2 0 0 0-3.46 0l-6 10.38A2 2 0 0 0 7.17 17H8" /><circle cx="12" cy="17" r="1" /><path d="M12 12v4" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-bg-card text-fg-secondary cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
          title="Toggle theme"
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <button
          onClick={toggleLang}
          className="h-9 px-3 rounded-lg border border-border bg-bg-card text-fg-secondary text-xs font-semibold cursor-pointer hover:bg-bg-secondary hover:text-fg transition-all active:scale-95"
          title="Toggle language"
        >
          {lang === 'id' ? 'EN' : 'ID'}
        </button>
      </div>

      <div className="text-center space-y-10 px-6 animate-fade-in">
        <div>
          <div className="flex justify-center mb-4 text-fg animate-fade-in-scale"><KeyIcon /></div>
          <h1 className="text-4xl font-bold text-fg tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-fg-muted mt-3 text-base">
            {t('home.subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-xs mx-auto animate-slide-up">
          <Link
            href="/admin"
            className="px-6 py-3.5 bg-accent text-accent-fg font-medium rounded-xl cursor-pointer hover:opacity-85 transition-all active:scale-[0.98] shadow-[var(--shadow)] flex items-center justify-center gap-2"
          >
            <SettingsIcon /> {t('home.admin')}
          </Link>

          <Link
            href="/panel"
            className="px-6 py-3.5 bg-bg-card text-fg font-semibold rounded-xl cursor-pointer hover:bg-bg-secondary transition-all border border-border active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <GridIcon /> {t('home.panel')}
          </Link>

          <Link
            href="/webhook-test"
            className="px-6 py-3.5 bg-bg-card text-fg-secondary font-medium rounded-xl cursor-pointer hover:bg-bg-secondary transition-all border border-border active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <WebhookIcon /> {t('home.webhookTest')}
          </Link>
        </div>

        <div className="text-fg-muted text-sm space-y-1 animate-slide-up stagger-2" style={{ opacity: 0 }}>
          <p>{t('home.products')}</p>
          <p className="text-fg-secondary">
            Fastpik · RAW File Copy Tool · Realtime Upload Pro · Photo Split Express
          </p>
        </div>
      </div>
    </div>
  );
}
