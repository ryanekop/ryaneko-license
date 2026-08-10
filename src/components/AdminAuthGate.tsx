'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { getAdminBrowserClient } from '@/lib/admin-browser-auth';

type Stage = 'loading' | 'login' | 'challenge' | 'enroll' | 'ready';
type Factor = { id: string; friendly_name?: string; status: string };

export default function AdminAuthGate({ children }: { children: ReactNode }) {
    const supabase = useMemo(() => getAdminBrowserClient(), []);
    const [stage, setStage] = useState<Stage>('loading');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [factors, setFactors] = useState<Factor[]>([]);
    const [factorId, setFactorId] = useState('');
    const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = new Headers(init?.headers);
        if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
        headers.set('X-Ryaneko-CSRF', '1');
        return window.fetch(input, { ...init, headers });
    }

    async function inspect() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setStage('login'); return; }
        const response = await authenticatedFetch('/api/admin/auth', { cache: 'no-store' });
        if (!response.ok) {
            await supabase.auth.signOut();
            setError('Akun ini tidak diizinkan sebagai admin.');
            setStage('login');
            return;
        }
        const payload = await response.json() as { aal: string; factors: Factor[] };
        setFactors(payload.factors);
        setFactorId(payload.factors[0]?.id || '');
        if (payload.factors.length === 0) { await startEnrollment(0); return; }
        if (payload.aal !== 'aal2') { setStage('challenge'); return; }
        if (payload.factors.length < 2) { await startEnrollment(payload.factors.length); return; }
        setStage('ready');
    }

    // Initial inspection intentionally runs once; auth transitions call inspect explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void inspect(); }, []);

    useEffect(() => {
        if (stage !== 'ready') return;
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            if (!url.startsWith('/api/admin') && !url.startsWith(window.location.origin + '/api/admin')) return originalFetch(input, init);
            const { data: { session } } = await supabase.auth.getSession();
            const headers = new Headers(init?.headers);
            if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
            headers.set('X-Ryaneko-CSRF', '1');
            return originalFetch(input, { ...init, headers });
        };
        return () => { window.fetch = originalFetch; };
    }, [stage, supabase]);

    async function login(event: FormEvent) {
        event.preventDefault(); setBusy(true); setError('');
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) { setError(loginError.message); setBusy(false); return; }
        await inspect(); setBusy(false);
    }

    async function startEnrollment(existingCount: number) {
        setStage('loading'); setError('');
        const { data: existingFactors } = await supabase.auth.mfa.listFactors();
        await Promise.all(
            (existingFactors?.totp || [])
                .filter((factor) => factor.status !== 'verified')
                .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
        );
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Ryaneko Admin ${existingCount + 1}` });
        if (enrollError || !data?.totp) { setError(enrollError?.message || 'Gagal membuat faktor.'); setStage('login'); return; }
        setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
        setCode(''); setStage('enroll');
    }

    async function verify() {
        const selected = enrollment?.id || factorId;
        if (!selected || code.length !== 6) return;
        setBusy(true); setError('');
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: selected });
        const verified = challenge ? await supabase.auth.mfa.verify({ factorId: selected, challengeId: challenge.id, code }) : null;
        if (challengeError || verified?.error) { setError(challengeError?.message || verified?.error?.message || 'Kode tidak valid.'); setBusy(false); return; }
        setEnrollment(null); setCode(''); await inspect(); setBusy(false);
    }

    if (stage === 'ready') return <>{children}</>;
    return <div className="min-h-screen flex items-center justify-center bg-bg p-4"><div className="bg-bg-card p-8 rounded-2xl border border-border w-full max-w-sm shadow-[var(--shadow-lg)] space-y-5">
        <div className="text-center"><h1 className="text-2xl font-bold text-fg">Ryaneko Admin</h1><p className="text-sm text-fg-muted mt-1">Supabase Auth + wajib dua TOTP</p></div>
        {stage === 'loading' ? <div className="text-center text-fg-muted">Memeriksa keamanan…</div> : null}
        {stage === 'login' ? <form onSubmit={login} className="space-y-3"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email admin" className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg" required /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Kata sandi" className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg" required /><button disabled={busy} className="w-full py-3 bg-accent text-accent-fg rounded-xl disabled:opacity-50">Masuk</button></form> : null}
        {stage === 'challenge' ? <div className="space-y-3"><select value={factorId} onChange={(event) => setFactorId(event.target.value)} className="w-full px-3 py-3 bg-bg border border-border rounded-xl text-fg">{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="Kode 6 digit" className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg text-center tracking-[.3em]" /><button onClick={verify} disabled={busy || code.length !== 6} className="w-full py-3 bg-accent text-accent-fg rounded-xl disabled:opacity-50">Verifikasi</button></div> : null}
        {stage === 'enroll' && enrollment ? <div className="space-y-3"><p className="text-sm text-fg-secondary">Admin wajib memiliki minimal dua faktor. Pindai QR ini pada perangkat berbeda.</p><Image src={enrollment.qr} alt="TOTP QR" width={208} height={208} unoptimized className="mx-auto size-52 bg-white p-2 rounded" /><code className="block break-all text-xs bg-bg p-2 rounded">{enrollment.secret}</code><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="Kode 6 digit" className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-fg text-center tracking-[.3em]" /><button onClick={verify} disabled={busy || code.length !== 6} className="w-full py-3 bg-accent text-accent-fg rounded-xl disabled:opacity-50">Aktifkan faktor</button></div> : null}
        {error ? <p className="text-danger text-sm text-center">{error}</p> : null}
    </div></div>;
}
