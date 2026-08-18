'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const EXIT_MS = 220;

export function usePresence(open: boolean, exitMs = EXIT_MS) {
    const [mounted, setMounted] = useState(open);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let frame = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (open) {
            timer = setTimeout(() => {
                setMounted(true);
                frame = window.requestAnimationFrame(() => setVisible(true));
            }, 0);
        } else {
            timer = setTimeout(() => {
                setVisible(false);
                timer = setTimeout(() => setMounted(false), exitMs);
            }, 0);
        }
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            if (timer) clearTimeout(timer);
        };
    }, [open, exitMs]);

    return { mounted, visible };
}

export function AdminModal({
    open,
    onClose,
    children,
    className = 'max-w-md',
    closeDisabled = false,
}: {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    closeDisabled?: boolean;
}) {
    const { mounted, visible } = usePresence(open);
    const contentRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        if (!mounted) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const previousFocus = document.activeElement as HTMLElement | null;
        const timer = window.setTimeout(() => contentRef.current?.focus(), 0);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !closeDisabled) onCloseRef.current();
            if (event.key !== 'Tab' || !contentRef.current) return;
            const focusable = Array.from(contentRef.current.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.clearTimeout(timer);
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
            previousFocus?.focus();
        };
    }, [mounted, closeDisabled]);

    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(
        <div className={`admin-modal ${visible ? 'is-open' : 'is-closing'}`} aria-hidden={!visible}>
            <button
                type="button"
                aria-label="Tutup dialog"
                className="admin-modal-backdrop"
                disabled={closeDisabled}
                onClick={onClose}
            />
            <div
                ref={contentRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={`admin-modal-content ${className}`}
            >
                <div className="max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-bg-card p-5 shadow-[var(--shadow-lg)] sm:p-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function AnimatedPopover({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
    const { mounted, visible } = usePresence(open, 170);
    if (!mounted) return null;
    return <div className={`admin-popover ${visible ? 'is-open' : 'is-closing'} ${className}`}>{children}</div>;
}
