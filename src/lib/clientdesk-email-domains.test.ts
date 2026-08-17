import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeClientDeskDnsRecord,
    validateClientDeskEmailDomainDraft,
} from './clientdesk-email-domains.ts';

test('normalizes TXT, CNAME, and MX records', () => {
    assert.deepEqual(normalizeClientDeskDnsRecord({ type: 'txt', name: ' @ ', value: ' verify=1 ' }), {
        type: 'TXT', name: '@', value: 'verify=1',
    });
    assert.deepEqual(normalizeClientDeskDnsRecord({ type: 'TXT', name: '_dmarc', value: 'v=DMARC1' }, 'example.com'), {
        type: 'TXT', name: '_dmarc.example.com', value: 'v=DMARC1',
    });
    assert.deepEqual(normalizeClientDeskDnsRecord({ type: 'MX', name: 'mail.example.com', value: 'smtp.sumopod.com', priority: 10 }), {
        type: 'MX', name: 'mail.example.com', value: 'smtp.sumopod.com', priority: 10,
    });
    assert.equal(normalizeClientDeskDnsRecord({ type: 'A', name: '@', value: '127.0.0.1' }), null);
});

test('requires DNS records before entering verification states', () => {
    assert.equal(validateClientDeskEmailDomainDraft({
        status: 'pending_admin', providerDomainId: '', adminNote: '', dnsRecords: [],
    }).ok, true);
    const pending = validateClientDeskEmailDomainDraft({
        status: 'dns_pending', providerDomainId: '', adminNote: '', dnsRecords: [],
    });
    assert.equal(pending.ok, false);
});

test('returns a trimmed ClientDesk admin API payload', () => {
    const result = validateClientDeskEmailDomainDraft({
        status: 'verified',
        providerDomainId: ' domain-123 ',
        adminNote: ' verified in Sumopod ',
        dnsRecords: [{ type: 'CNAME', name: ' sumo._domainkey.example.com ', value: ' target.example.net ' }],
    }, 'example.com');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.providerDomainId, 'domain-123');
    assert.equal(result.data.adminNote, 'verified in Sumopod');
    assert.equal(result.data.dnsRecords[0].name, 'sumo._domainkey.example.com');
});
