'use client';

import { useLang } from '@/lib/providers';

const CameraIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
    </svg>
);

const ConstructionIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="8" rx="1" /><path d="M17 14v7" /><path d="M7 14v7" /><path d="M17 3v3" /><path d="M7 3v3" /><path d="M10 14 2.3 6.3" /><path d="m14 6 7.7 7.7" /><path d="m8 6 8 8" />
    </svg>
);

export default function FastpikPage() {
    const { t } = useLang();

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-fg flex items-center gap-2.5">
                    <CameraIcon /> {t('fastpik.title')}
                </h2>
                <p className="text-fg-muted text-sm mt-2">
                    {t('fastpik.desc')}
                </p>
            </div>

            <div className="bg-bg-card rounded-xl border border-border p-12 text-center shadow-[var(--shadow)] animate-slide-up">
                <div className="flex justify-center mb-4 text-fg-muted"><ConstructionIcon /></div>
                <h3 className="text-lg font-semibold text-fg mb-2">{t('fastpik.coming')}</h3>
                <p className="text-fg-muted text-sm">
                    {t('fastpik.comingDesc')}
                </p>
                <p className="text-fg-muted/50 text-xs mt-4">
                    {t('fastpik.note')}
                </p>
            </div>
        </div>
    );
}
