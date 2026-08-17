export const CLIENTDESK_EMAIL_DOMAIN_STATUSES = [
    'pending_admin',
    'dns_pending',
    'dns_detected',
    'verified',
    'rejected',
    'failed',
] as const;

export type ClientDeskEmailDomainStatus = (typeof CLIENTDESK_EMAIL_DOMAIN_STATUSES)[number];
export type ClientDeskDnsRecordType = 'TXT' | 'CNAME' | 'MX';

export interface ClientDeskDnsRecord {
    type: ClientDeskDnsRecordType;
    name: string;
    value: string;
    priority?: number;
}

export interface ClientDeskEmailDomainDraft {
    status: ClientDeskEmailDomainStatus;
    providerDomainId: string;
    adminNote: string;
    dnsRecords: ClientDeskDnsRecord[];
}

export function normalizeClientDeskDnsRecord(value: unknown, sendingDomain?: string): ClientDeskDnsRecord | null {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const type = String(row.type || '').toUpperCase();
    if (type !== 'TXT' && type !== 'CNAME' && type !== 'MX') return null;
    const rawName = String(row.name || '').trim().toLowerCase().replace(/\.$/, '');
    const domain = String(sendingDomain || '').trim().toLowerCase().replace(/\.$/, '');
    const name = domain
        ? rawName === '@' || rawName === domain
            ? domain
            : rawName.endsWith(`.${domain}`)
                ? rawName
                : `${rawName}.${domain}`
        : rawName;
    const recordValue = String(row.value || '').trim();
    if (!name || !recordValue) return null;
    return {
        type,
        name,
        value: recordValue,
        ...(type === 'MX' && Number.isInteger(Number(row.priority))
            ? { priority: Math.min(Math.max(Number(row.priority), 0), 65535) }
            : {}),
    };
}

export function validateClientDeskEmailDomainDraft(value: ClientDeskEmailDomainDraft, sendingDomain?: string) {
    if (!CLIENTDESK_EMAIL_DOMAIN_STATUSES.includes(value.status)) {
        return { ok: false as const, error: 'Status domain tidak valid.' };
    }
    const records = value.dnsRecords.map((record) => normalizeClientDeskDnsRecord(record, sendingDomain));
    if (records.some((record) => !record)) {
        return { ok: false as const, error: 'Semua DNS record wajib memiliki tipe, name, dan value.' };
    }
    if (
        (value.status === 'dns_pending' || value.status === 'dns_detected' || value.status === 'verified') &&
        records.length === 0
    ) {
        return { ok: false as const, error: 'Tambahkan minimal satu DNS record untuk status ini.' };
    }
    return {
        ok: true as const,
        data: {
            status: value.status,
            providerDomainId: value.providerDomainId.trim() || null,
            adminNote: value.adminNote.trim().slice(0, 2000) || null,
            dnsRecords: records as ClientDeskDnsRecord[],
        },
    };
}
