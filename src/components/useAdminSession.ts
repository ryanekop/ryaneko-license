'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAdminSession() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const revision = useRef(0);

    useEffect(() => {
        const controller = new AbortController();
        let checking = false;
        const checkSession = async () => {
            if (checking) return;
            checking = true;
            const currentRevision = revision.current;
            try {
                const response = await fetch('/api/admin/auth', { signal: controller.signal, cache: 'no-store' });
                const data = response.ok ? await response.json() : { authenticated: false };
                if (currentRevision === revision.current) setIsAuthenticated(data.authenticated === true);
            } catch {
                if (!controller.signal.aborted && currentRevision === revision.current) setIsAuthenticated(false);
            } finally {
                checking = false;
                if (!controller.signal.aborted) setAuthChecking(false);
            }
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') void checkSession();
        };
        void checkSession();
        const timer = window.setInterval(onVisible, 30_000);
        window.addEventListener('focus', onVisible);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            controller.abort();
            window.clearInterval(timer);
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    const login = useCallback(async (password: string, remember: boolean) => {
        revision.current += 1;
        const response = await fetch('/api/admin/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, remember }),
        });
        revision.current += 1;
        setIsAuthenticated(response.ok);
        setLogoutError('');
        return response.ok;
    }, []);

    const logout = useCallback(async () => {
        revision.current += 1;
        setIsLoggingOut(true);
        setLogoutError('');
        try {
            const response = await fetch('/api/admin/auth', { method: 'DELETE' });
            if (!response.ok) throw new Error('Logout failed');
            revision.current += 1;
            setIsAuthenticated(false);
        } catch {
            setLogoutError('Connection error');
        } finally {
            setIsLoggingOut(false);
        }
    }, []);

    return { isAuthenticated, authChecking, login, logout, isLoggingOut, logoutError, setIsAuthenticated };
}
