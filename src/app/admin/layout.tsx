'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminLayoutProps {
    children: ReactNode;
}

const TABS = [
    { name: '📂 RAW File Copy', href: '/admin/raw-file-copy', slug: 'raw-file-copy-tool' },
    { name: '📤 Realtime Upload', href: '/admin/realtime-upload', slug: 'realtime-upload-pro' },
    { name: '✂️ Photo Split', href: '/admin/photo-split', slug: 'photo-split-express' },
    { name: '📸 Fastpik', href: '/admin/fastpik', slug: 'fastpik' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const pathname = usePathname();

    useEffect(() => {
        const saved = sessionStorage.getItem('admin_auth');
        if (saved === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/admin/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });

        if (res.ok) {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_auth', 'true');
        } else {
            setError('Password salah!');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 w-full max-w-sm mx-4">
                    <div className="text-center mb-8">
                        <div className="text-5xl mb-3">🔑</div>
                        <h1 className="text-2xl font-bold text-white">
                            Ryaneko License
                        </h1>
                        <p className="text-neutral-500 mt-1 text-sm">Admin Dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 transition-all"
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-3 bg-white text-neutral-900 font-medium rounded-xl hover:bg-neutral-200 transition-colors"
                        >
                            Login →
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            {/* Header */}
            <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🔑</span>
                            <h1 className="text-lg font-semibold text-white">
                                Ryaneko License
                            </h1>
                        </div>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('admin_auth');
                                setIsAuthenticated(false);
                            }}
                            className="px-3 py-1.5 text-sm text-neutral-500 hover:text-white border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-neutral-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <nav className="flex space-x-1 overflow-x-auto py-2 -mb-px">
                        {TABS.map((tab) => {
                            const isActive = pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.slug}
                                    href={tab.href}
                                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${isActive
                                            ? 'bg-white text-neutral-900 font-medium'
                                            : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
                                        }`}
                                >
                                    {tab.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {children}
            </main>
        </div>
    );
}
