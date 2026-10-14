const LONG_PREFIX = /^politeknik\s+kesehatan\b/i;
const SHORT_PREFIX = /^poltekkes\b/i;

export function canonicalizeUniversityName(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(LONG_PREFIX, 'Poltekkes');
}

export function universityNameKeys(value: string): string[] {
    const canonical = canonicalizeUniversityName(value);
    const legacy = canonical.replace(SHORT_PREFIX, 'Politeknik Kesehatan');
    return [...new Set([value.trim(), canonical, legacy].map((name) => name.toLowerCase()))];
}

export function universitySearchVariants(value: string): string[] {
    const keyword = value.trim();
    const canonical = keyword.replace(/\bpoliteknik\s+kesehatan\b/gi, 'Poltekkes');
    const legacy = canonical.replace(/\bpoltekkes\b/gi, 'Politeknik Kesehatan');
    return [...new Set([keyword, canonical, legacy])];
}
