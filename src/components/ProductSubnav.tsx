'use client';

import type { ReactNode } from 'react';

export type ProductSubnavKey = 'users' | 'blocklist' | 'email-domains' | 'maintenance' | 'vendor';

export interface ProductSubnavItem {
    key: ProductSubnavKey;
    label: string;
    icon: ReactNode;
}

interface ProductSubnavProps {
    activeKey: ProductSubnavKey;
    ariaLabel: string;
    items: ProductSubnavItem[];
    onSelect: (key: ProductSubnavKey) => void;
}

export const ProductSubnavIcons = {
    users: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    blocklist: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
        </svg>
    ),
    emailDomains: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-10 5L2 7" /><circle cx="18" cy="18" r="3" />
        </svg>
    ),
    maintenance: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
        </svg>
    ),
    vendor: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M9 22v-6h6v6" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-.8 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
        </svg>
    ),
};

export function ProductSubnav({ activeKey, ariaLabel, items, onSelect }: ProductSubnavProps) {
    return (
        <>
            <div className="sm:hidden">
                <label className="sr-only" htmlFor={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-navigation`}>
                    {ariaLabel}
                </label>
                <select
                    id={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-navigation`}
                    value={activeKey}
                    onChange={(event) => onSelect(event.target.value as ProductSubnavKey)}
                    className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm font-semibold text-fg shadow-[var(--shadow)] outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                >
                    {items.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
            </div>

            <nav
                aria-label={ariaLabel}
                className="hidden w-fit rounded-xl border border-border bg-bg-card p-1 shadow-[var(--shadow)] sm:inline-flex"
            >
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        aria-current={activeKey === item.key ? 'page' : undefined}
                        onClick={() => onSelect(item.key)}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                            activeKey === item.key
                                ? 'bg-accent text-accent-fg shadow-sm'
                                : 'text-fg-secondary hover:bg-bg-secondary hover:text-fg'
                        }`}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </nav>
        </>
    );
}
