'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type Lang = 'id' | 'en';

// --- THEME ---
interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => { } });

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        const saved = localStorage.getItem('rl-theme') as Theme | null;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initial = saved || (prefersDark ? 'dark' : 'light');
        setTheme(initial);
        document.documentElement.setAttribute('data-theme', initial);
    }, []);

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        localStorage.setItem('rl-theme', next);
        document.documentElement.setAttribute('data-theme', next);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);

// --- LANGUAGE ---
const translations = {
    id: {
        'login.title': 'Ryaneko License',
        'login.subtitle': 'Admin Dashboard',
        'login.placeholder': 'Masukkan password',
        'login.button': 'Masuk',
        'login.loading': 'Memverifikasi...',
        'login.error': 'Password salah!',
        'header.title': 'Ryaneko License',
        'header.logout': 'Keluar',
        'tab.rawFileCopy': 'RAW File Copy',
        'tab.realtimeUpload': 'Realtime Upload',
        'tab.photoSplit': 'Photo Split',
        'tab.fastpik': 'Fastpik',
        'list.total': 'Total',
        'list.available': 'Tersedia',
        'list.used': 'Digunakan',
        'list.refresh': 'Refresh',
        'list.search': 'Cari nama, email, atau serial...',
        'list.allStatus': 'Semua Status',
        'list.statusAvailable': 'Tersedia',
        'list.statusUsed': 'Digunakan',
        'list.statusRevoked': 'Dicabut',
        'list.serial': 'Serial',
        'list.status': 'Status',
        'list.name': 'Nama',
        'list.email': 'Email',
        'list.device': 'Device',
        'list.activated': 'Diaktivasi',
        'list.actions': 'Aksi',
        'list.loading': 'Memuat...',
        'list.empty': 'Tidak ada lisensi ditemukan',
        'list.previous': 'Sebelumnya',
        'list.next': 'Selanjutnya',
        'list.page': 'Halaman',
        'list.of': 'dari',
        'list.sortNewest': 'Terbaru',
        'list.sortOldest': 'Terlama',
        'list.showEmpty': 'Serial Kosong',
        'list.hideEmpty': 'Sembunyikan',
        'action.change': 'Ubah',
        'action.reset': 'Reset',
        'action.delete': 'Hapus',
        'dialog.changeTitle': 'Ubah Platform Device',
        'dialog.changeDesc': 'Pilih platform baru untuk lisensi ini:',
        'dialog.selectPlatform': 'Pilih Platform',
        'dialog.cancel': 'Batal',
        'dialog.confirm': 'Konfirmasi',
        'dialog.processing': 'Memproses...',
        'dialog.resetTitle': 'Reset Lisensi',
        'dialog.resetDesc': 'Apakah kamu yakin ingin mereset lisensi ini? Status akan berubah menjadi "tersedia" dan data device akan dihapus.',
        'dialog.resetSerial': 'Serial',
        'dialog.resetUser': 'User',
        'dialog.deleteTitle': 'Hapus Lisensi',
        'dialog.deleteDesc': 'Apakah kamu yakin ingin menghapus lisensi ini secara permanen? Aksi ini tidak bisa dibatalkan.',
        'fastpik.title': 'Fastpik',
        'fastpik.desc': 'Fastpik menggunakan sistem membership Mayar',
        'fastpik.coming': 'Coming Soon',
        'fastpik.comingDesc': 'Integrasi dengan Mayar Membership API akan segera hadir.',
        'fastpik.note': 'Sementara ini, kelola membership Fastpik di dashboard Mayar.',
        'home.title': 'Ryaneko License',
        'home.subtitle': 'License Management System',
        'home.admin': 'Admin Dashboard',
        'home.webhook': 'Webhook Status',
        'home.products': 'Produk yang Didukung',
    },
    en: {
        'login.title': 'Ryaneko License',
        'login.subtitle': 'Admin Dashboard',
        'login.placeholder': 'Enter password',
        'login.button': 'Login',
        'login.loading': 'Verifying...',
        'login.error': 'Wrong password!',
        'header.title': 'Ryaneko License',
        'header.logout': 'Logout',
        'tab.rawFileCopy': 'RAW File Copy',
        'tab.realtimeUpload': 'Realtime Upload',
        'tab.photoSplit': 'Photo Split',
        'tab.fastpik': 'Fastpik',
        'list.total': 'Total',
        'list.available': 'Available',
        'list.used': 'Used',
        'list.refresh': 'Refresh',
        'list.search': 'Search name, email, or serial...',
        'list.allStatus': 'All Status',
        'list.statusAvailable': 'Available',
        'list.statusUsed': 'Used',
        'list.statusRevoked': 'Revoked',
        'list.serial': 'Serial',
        'list.status': 'Status',
        'list.name': 'Name',
        'list.email': 'Email',
        'list.device': 'Device',
        'list.activated': 'Activated',
        'list.actions': 'Actions',
        'list.loading': 'Loading...',
        'list.empty': 'No licenses found',
        'list.previous': 'Previous',
        'list.next': 'Next',
        'list.page': 'Page',
        'list.of': 'of',
        'list.sortNewest': 'Newest',
        'list.sortOldest': 'Oldest',
        'list.showEmpty': 'Empty Serials',
        'list.hideEmpty': 'Hide Empty',
        'action.change': 'Change',
        'action.reset': 'Reset',
        'action.delete': 'Delete',
        'dialog.changeTitle': 'Change Device Platform',
        'dialog.changeDesc': 'Select a new platform for this license:',
        'dialog.selectPlatform': 'Select Platform',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Confirm',
        'dialog.processing': 'Processing...',
        'dialog.resetTitle': 'Reset License',
        'dialog.resetDesc': 'Are you sure you want to reset this license? The status will change to "available" and device data will be cleared.',
        'dialog.resetSerial': 'Serial',
        'dialog.resetUser': 'User',
        'dialog.deleteTitle': 'Delete License',
        'dialog.deleteDesc': 'Are you sure you want to permanently delete this license? This action cannot be undone.',
        'fastpik.title': 'Fastpik',
        'fastpik.desc': 'Fastpik uses Mayar membership system',
        'fastpik.coming': 'Coming Soon',
        'fastpik.comingDesc': 'Integration with Mayar Membership API coming soon.',
        'fastpik.note': 'For now, manage Fastpik membership on Mayar dashboard.',
        'home.title': 'Ryaneko License',
        'home.subtitle': 'License Management System',
        'home.admin': 'Admin Dashboard',
        'home.webhook': 'Webhook Status',
        'home.products': 'Supported Products',
    },
} as const;

type TranslationKey = keyof typeof translations.id;

interface LangContextType {
    lang: Lang;
    toggleLang: () => void;
    t: (key: TranslationKey) => string;
}

const LangContext = createContext<LangContextType>({
    lang: 'id',
    toggleLang: () => { },
    t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Lang>('id');

    useEffect(() => {
        const saved = localStorage.getItem('rl-lang') as Lang | null;
        if (saved) setLang(saved);
    }, []);

    const toggleLang = () => {
        const next = lang === 'id' ? 'en' : 'id';
        setLang(next);
        localStorage.setItem('rl-lang', next);
    };

    const t = (key: TranslationKey): string => {
        return translations[lang][key] || key;
    };

    return (
        <LangContext.Provider value={{ lang, toggleLang, t }}>
            {children}
        </LangContext.Provider>
    );
}

export const useLang = () => useContext(LangContext);
