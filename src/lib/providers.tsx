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
        'login.title': 'Ryan Eko License',
        'login.subtitle': 'Admin Dashboard',
        'login.placeholder': 'Masukkan password',
        'login.button': 'Masuk',
        'login.loading': 'Memverifikasi...',
        'login.error': 'Password salah!',
        'header.title': 'Ryan Eko License',
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
        'list.deviceId': 'Device ID',
        'list.instagram': 'Instagram',
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
        'list.allDevices': 'Semua Device',
        'list.filterDevice': 'Filter Device',
        'action.editDevice': 'Edit Device',
        'action.editTable': 'Edit Tabel',
        'action.reset': 'Reset',
        'action.delete': 'Hapus',
        'dialog.changeTitle': 'Edit Device',
        'dialog.changeDesc': 'Pilih platform baru untuk lisensi ini:',
        'dialog.selectPlatform': 'Pilih Platform',
        'dialog.cancel': 'Batal',
        'dialog.confirm': 'Konfirmasi',
        'dialog.processing': 'Memproses...',
        'dialog.resetTitle': 'Reset Lisensi',
        'dialog.resetDesc': 'Apakah kamu yakin ingin mereset lisensi ini? Status akan berubah menjadi "tersedia" dan data device akan dihapus.',
        'dialog.resetSerial': 'Serial',
        'dialog.resetUser': 'User',
        'dialog.deleteTitle': 'Hapus Informasi',
        'dialog.deleteDesc': 'Apakah kamu yakin ingin menghapus informasi pada serial ini? Nama, email, device, dan data lainnya akan dihapus. Serial tetap tersimpan.',
        'dialog.editTableTitle': 'Edit Tabel',
        'dialog.editTableDesc': 'Edit data serial, nama, email, dan device ID secara manual:',
        'dialog.serialKey': 'Serial Key',
        'dialog.customerName': 'Nama',
        'dialog.customerEmail': 'Email',
        'dialog.customerInstagram': 'Instagram',
        'dialog.deviceId': 'Device ID',
        'fastpik.title': 'Fastpik',
        'fastpik.desc': 'Kelola user & membership Fastpik',
        'fastpik.refresh': 'Refresh',
        'fastpik.newUser': 'User Baru',
        'fastpik.inviteTitle': 'Undang User Trial',
        'fastpik.namePlaceholder': 'Nama lengkap',
        'fastpik.emailPlaceholder': 'Email',
        'fastpik.day': 'hari',
        'fastpik.days': 'hari',
        'fastpik.sendInvite': 'Kirim Undangan',
        'fastpik.userCount': 'Total User',
        'fastpik.noUsers': 'Belum ada user',
        'fastpik.colName': 'Nama',
        'fastpik.colEmail': 'Email',
        'fastpik.colPlan': 'Paket',
        'fastpik.colExpiry': 'Kadaluarsa',
        'fastpik.colRegistered': 'Terdaftar',
        'fastpik.colActions': 'Aksi',
        'fastpik.never': 'Selamanya',
        'fastpik.deleteTitle': 'Hapus User',
        'fastpik.deleteConfirm': 'Yakin ingin menghapus',
        'fastpik.editTitle': 'Edit Langganan',
        'fastpik.editDesc': 'Ubah langganan untuk',
        'fastpik.setExpiry': 'Masa Berlaku',
        'fastpik.save': 'Simpan',
        'fastpik.or': 'Atau',
        'fastpik.changeTier': 'Ganti Paket',
        'fastpik.change': 'Ganti',
        'fastpik.searchPlaceholder': 'Cari nama atau email...',
        'tab.generate': 'Generate Serial',
        'generate.title': 'Generate Serial Key',
        'generate.desc': 'Buat serial key baru untuk produk yang dipilih. Serial akan otomatis tersimpan ke database.',
        'generate.product': 'Pilih Produk',
        'generate.selectProduct': 'Pilih produk...',
        'generate.count': 'Jumlah Serial',
        'generate.button': 'Generate Serial',
        'generate.generating': 'Generating...',
        'generate.success': 'Serial berhasil dibuat!',
        'generate.copied': 'Tersalin!',
        'generate.copyAll': 'Salin Semua',
        'generate.copyHash': 'Salin + Hash',
        'generate.serialKey': 'Serial Key',
        'generate.sha256': 'SHA256 Hash',
        'generate.viewDB': 'Lihat di Database',
        'generate.preview': 'Preview Serial',
        'generate.previewDesc': 'Belum tersimpan ke database',
        'generate.saveDB': 'Simpan ke Database',
        'generate.savingDB': 'Menyimpan...',
        'generate.saved': 'Berhasil disimpan ke database!',
        'home.title': 'Ryan Eko License',
        'home.subtitle': 'License Management System',
        'home.admin': 'Admin Dashboard',
        'home.webhook': 'Webhook Status',
        'home.webhookTest': 'Webhook Tester',
        'home.products': 'Produk yang Didukung',
    },
    en: {
        'login.title': 'Ryan Eko License',
        'login.subtitle': 'Admin Dashboard',
        'login.placeholder': 'Enter password',
        'login.button': 'Login',
        'login.loading': 'Verifying...',
        'login.error': 'Wrong password!',
        'header.title': 'Ryan Eko License',
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
        'list.deviceId': 'Device ID',
        'list.instagram': 'Instagram',
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
        'list.allDevices': 'All Devices',
        'list.filterDevice': 'Filter Device',
        'action.editDevice': 'Edit Device',
        'action.editTable': 'Edit Table',
        'action.reset': 'Reset',
        'action.delete': 'Delete',
        'dialog.changeTitle': 'Edit Device',
        'dialog.changeDesc': 'Select a new platform for this license:',
        'dialog.selectPlatform': 'Select Platform',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Confirm',
        'dialog.processing': 'Processing...',
        'dialog.resetTitle': 'Reset License',
        'dialog.resetDesc': 'Are you sure you want to reset this license? The status will change to "available" and device data will be cleared.',
        'dialog.resetSerial': 'Serial',
        'dialog.resetUser': 'User',
        'dialog.deleteTitle': 'Clear Information',
        'dialog.deleteDesc': 'Are you sure you want to clear the information on this serial? Name, email, device, and other data will be removed. The serial key will remain.',
        'dialog.editTableTitle': 'Edit Table',
        'dialog.editTableDesc': 'Manually edit serial, name, email, and device ID:',
        'dialog.serialKey': 'Serial Key',
        'dialog.customerName': 'Name',
        'dialog.customerEmail': 'Email',
        'dialog.customerInstagram': 'Instagram',
        'dialog.deviceId': 'Device ID',
        'fastpik.title': 'Fastpik',
        'fastpik.desc': 'Manage Fastpik users & membership',
        'fastpik.refresh': 'Refresh',
        'fastpik.newUser': 'New User',
        'fastpik.inviteTitle': 'Invite Trial User',
        'fastpik.namePlaceholder': 'Full name',
        'fastpik.emailPlaceholder': 'Email',
        'fastpik.day': 'day',
        'fastpik.days': 'days',
        'fastpik.sendInvite': 'Send Invite',
        'fastpik.userCount': 'Total Users',
        'fastpik.noUsers': 'No users found',
        'fastpik.colName': 'Name',
        'fastpik.colEmail': 'Email',
        'fastpik.colPlan': 'Plan',
        'fastpik.colExpiry': 'Expiry',
        'fastpik.colRegistered': 'Registered',
        'fastpik.colActions': 'Actions',
        'fastpik.never': 'Never',
        'fastpik.deleteTitle': 'Delete User',
        'fastpik.deleteConfirm': 'Are you sure you want to delete',
        'fastpik.editTitle': 'Edit Subscription',
        'fastpik.editDesc': 'Modify subscription for',
        'fastpik.setExpiry': 'Expiry Date',
        'fastpik.save': 'Save',
        'fastpik.or': 'Or',
        'fastpik.changeTier': 'Change Plan',
        'fastpik.change': 'Change',
        'fastpik.searchPlaceholder': 'Search name or email...',
        'tab.generate': 'Generate Serial',
        'generate.title': 'Generate Serial Key',
        'generate.desc': 'Create new serial keys for the selected product. Serials are saved to database automatically.',
        'generate.product': 'Select Product',
        'generate.selectProduct': 'Select product...',
        'generate.count': 'Number of Serials',
        'generate.button': 'Generate Serial',
        'generate.generating': 'Generating...',
        'generate.success': 'Serials generated successfully!',
        'generate.copied': 'Copied!',
        'generate.copyAll': 'Copy All',
        'generate.copyHash': 'Copy + Hash',
        'generate.serialKey': 'Serial Key',
        'generate.sha256': 'SHA256 Hash',
        'generate.viewDB': 'View in Database',
        'generate.preview': 'Serial Preview',
        'generate.previewDesc': 'Not yet saved to database',
        'generate.saveDB': 'Save to Database',
        'generate.savingDB': 'Saving...',
        'generate.saved': 'Successfully saved to database!',
        'home.title': 'Ryan Eko License',
        'home.subtitle': 'License Management System',
        'home.admin': 'Admin Dashboard',
        'home.webhook': 'Webhook Status',
        'home.webhookTest': 'Webhook Tester',
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
