'use client';

import { createPortal } from 'react-dom';

interface AdminToastProps {
    toast: { success: boolean; message: string } | null;
}

export function AdminToast({ toast }: AdminToastProps) {
    if (!toast || typeof document === 'undefined') return null;

    return createPortal(
        <div className={`fixed right-4 top-20 z-[10000] w-[calc(100vw-2rem)] max-w-sm px-4 py-2.5 rounded-xl border shadow-[var(--shadow-lg)] text-sm animate-fade-in ${
            toast.success
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-danger/10 border-danger/20 text-danger'
        }`}>
            {toast.message}
        </div>,
        document.body
    );
}
