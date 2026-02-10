'use client';

import { useLang } from '@/lib/providers';

export default function FastpikPage() {
    const { t } = useLang();

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-fg flex items-center gap-2">
                    <span>📸</span> {t('fastpik.title')}
                </h2>
                <p className="text-fg-muted text-sm mt-2">
                    {t('fastpik.desc')}
                </p>
            </div>

            <div className="bg-bg-card rounded-xl border border-border p-12 text-center shadow-[var(--shadow)] animate-slide-up">
                <div className="text-5xl mb-4">🚧</div>
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
