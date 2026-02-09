'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminLayoutProps {
    children: ReactNode;
}

const TABS = [
    { name: 'RAW File Copy', href: '/admin/raw-file-copy', slug: 'raw-file-copy-tool' },
    { name: 'Realtime Upload', href: '/admin/realtime-upload', slug: 'realtime-upload-pro' },
    { name: 'Photo Split', href: '/admin/photo-split', slug: 'photo-split-express' },
    { name: 'Fastpik', href: '/admin/fastpik', slug: 'fastpik' },
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <div className="bg-gray-800/50 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            🔐 Ryaneko License
                        </h1>
                        <p className="text-gray-400 mt-2">Admin Dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Header */}
            <header className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            🔐 Ryaneko License Manager
                        </h1>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('admin_auth');
                                setIsAuthenticated(false);
                            }}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-gray-800/30 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex space-x-1 overflow-x-auto py-2">
                        {TABS.map((tab) => {
                            const isActive = pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.slug}
                                    href={tab.href}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${isActive
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
            <main className="max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
