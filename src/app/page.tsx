'use client';

import Link from 'next/link';
import { useTheme, useLang } from '@/lib/providers';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-border bg-bg-card hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
          title="Toggle theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          onClick={toggleLang}
          className="px-3 py-2 rounded-lg border border-border bg-bg-card text-fg-secondary text-xs font-medium hover:bg-bg-secondary transition-all hover:scale-105 active:scale-95"
          title="Toggle language"
        >
          {lang === 'id' ? '🇬🇧 EN' : '🇮🇩 ID'}
        </button>
      </div>

      <div className="text-center space-y-10 px-6 animate-fade-in">
        <div>
          <div className="text-6xl mb-4 animate-fade-in-scale">🔑</div>
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
            className="px-6 py-3.5 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[var(--shadow)]"
          >
            {t('home.admin')}
          </Link>

          <Link
            href="/api/mayar/webhook"
            className="px-6 py-3.5 bg-bg-card text-fg-secondary font-medium rounded-xl hover:bg-bg-secondary transition-all border border-border hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('home.webhook')}
          </Link>
        </div>

        <div className="text-fg-muted text-sm space-y-1 animate-slide-up stagger-2" style={{ opacity: 0 }}>
          <p>{t('home.products')}</p>
          <p className="text-fg-secondary">
            📂 RAW File Copy Tool · 📤 Realtime Upload Pro · ✂️ Photo Split Express
          </p>
        </div>
      </div>
    </div>
  );
}
