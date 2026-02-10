import LicenseList from '@/components/LicenseList';

const FolderIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
);

const PLATFORMS = [
    { value: 'Windows', label: 'Windows' },
    { value: 'Mac', label: 'Mac' },
    { value: 'Mac (Monterey)', label: 'Mac (Monterey)' },
];

export default function RawFileCopyPage() {
    return (
        <LicenseList
            productSlug="raw-file-copy-tool"
            productName="RAW File Copy Tool"
            productIcon={<FolderIcon />}
            platforms={PLATFORMS}
        />
    );
}
