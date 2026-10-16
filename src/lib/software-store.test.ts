import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hashStoreToken, normalizeStoreEmail, SOFTWARE_OS_OPTIONS, SOFTWARE_PACKAGES, SOFTWARE_SOURCES,
    softwareDownloads, softwarePurchaseNotification, softwareRedirectMatches, softwareTransactionMatches, validateSoftwareCheckout, validStoreToken,
} from './software-store.ts';
import { extractPaymentCheckoutUrl, type MayarTransaction } from './mayar-v2.ts';

const customer = {
    name: '  Budi Santoso  ', email: '  BUDI@example.com  ', mobile: '+628123456789',
    instagram: '@budi.photo', os: 'Windows 11', source: 'Website',
};

test('OS catalog groups oldest-to-newest Mac, Windows, then Android without changing labels', () => {
    assert.deepEqual(SOFTWARE_OS_OPTIONS, [
        'Mac OS Monterey (12.4+)', 'Mac OS Ventura (13.5+)', 'Mac OS Sonoma (14.6+)',
        'Mac OS Sequoia (15.6+)', 'Mac OS Tahoe (26.0+)', 'Mac OS Golden Gate (27.0+)',
        'Windows 7', 'Windows 8/8.1', 'Windows 10', 'Windows 11', 'Android',
    ]);
});

test('v2 purchase notification includes committed purchase details and escapes dynamic HTML', () => {
    const message = softwarePurchaseNotification({
        id: 'order<&>', customer_name: 'Buyer <b>&"\'', customer_email: 'buyer&photo@example.test',
        customer_mobile: '+628123456789', customer_instagram: '<instagram>', os: 'Windows <11>',
        source: 'Friends & family', amount: 196000, license_count: 2,
    }, 'transaction<&>', ['SERIAL<1>', 'SERIAL&2']);
    for (const content of [
        '<b>New Purchase! v2</b>', 'RAW File Copy Tool', 'Buyer &lt;b&gt;&amp;&quot;&#39;',
        'buyer&amp;photo@example.test', '+628123456789', '&lt;instagram&gt;', 'Windows &lt;11&gt;',
        'Friends &amp; family', 'Rp 196.000', 'Jumlah lisensi: 2', 'order&lt;&amp;&gt;',
        'transaction&lt;&amp;&gt;', '<code>SERIAL&lt;1&gt;</code>', '<code>SERIAL&amp;2</code>',
    ]) assert.ok(message.includes(content), content);
    assert.ok(!message.includes('Buyer <b>'));
});

test('purchase serials are inline for one and numbered for multiple, with escaped HTML', () => {
    const serials = ['SERIAL<1>', 'SERIAL&2', 'SERIAL"3'];
    const escaped = ['SERIAL&lt;1&gt;', 'SERIAL&amp;2', 'SERIAL&quot;3'];
    for (const count of [1, 2, 3]) {
        const message = softwarePurchaseNotification({
            id: 'order', customer_name: 'Buyer', customer_email: 'buyer@example.test',
            customer_mobile: '+628123456789', customer_instagram: 'buyer', os: 'Windows 11',
            source: 'Website', amount: SOFTWARE_PACKAGES[count - 1].price, license_count: count,
        }, 'transaction', serials.slice(0, count));
        const expected = count === 1
            ? '🔐 Serial number: <code>SERIAL&lt;1&gt;</code>'
            : ['🔐 Serial number:', ...escaped.slice(0, count).map((serial, index) => `${index + 1}. <code>${serial}</code>`)].join('\n');
        assert.equal(message.slice(message.indexOf('🔐 Serial number:')), expected);
    }
});

test('software packages use canonical pricing and normalized buyer fields', () => {
    for (const selection of SOFTWARE_PACKAGES) {
        const result = validateSoftwareCheckout({ ...customer, amount: 1, price: 1 }, selection.count);
        assert.equal(result.count, selection.count);
        assert.equal(result.amount, selection.price);
        assert.deepEqual(result.customer, {
            ...customer, name: 'Budi Santoso', email: 'budi@example.com', instagram: 'budi.photo',
        });
    }
});

test('checkout rejects unsupported packages rather than coercing client values', () => {
    for (const count of [0, 4, -1, 1.5, '1', null, undefined, {}, NaN]) {
        assert.throws(() => validateSoftwareCheckout(customer, count), /invalid_package/);
    }
});

test('per-device OS validates exact package size and keeps legacy requests compatible', () => {
    for (const count of [1, 2, 3]) {
        const deviceOs = ['Windows 11', 'Mac OS Tahoe (26.0+)', 'Android'].slice(0, count);
        assert.deepEqual(validateSoftwareCheckout({ ...customer, deviceOs }, count).customer.deviceOs, deviceOs);
        assert.deepEqual(validateSoftwareCheckout({ ...customer, deviceOs: Array(count).fill(customer.os) }, count).customer.deviceOs, Array(count).fill(customer.os));
        assert.equal(validateSoftwareCheckout(customer, count).customer.deviceOs, undefined);
    }
    for (const deviceOs of [null, 'Windows 11', [], ['Windows 11'], ['Windows 11', ''], ['Windows 11', 'Linux'], ['Android', 'Windows 11'], ['Windows 11', 1]]) {
        assert.throws(() => validateSoftwareCheckout({ ...customer, deviceOs }, 2), /invalid_customer/);
    }
});

test('Telegram lists every device OS including repeats and escapes HTML', () => {
    const order = { id: 'order', customer_name: 'Buyer', customer_email: 'buyer@example.test', customer_mobile: '081234567890', customer_instagram: 'buyer', os: 'Windows 11', source: 'Website', amount: 278000, license_count: 3 };
    const message = softwarePurchaseNotification({ ...order, device_os: ['Windows <11>', 'Mac OS & Tahoe', 'Windows <11>'] }, 'txn', ['one', 'two', 'three']);
    assert.ok(message.includes('💻 OS Device 1: Windows &lt;11&gt;\n💻 OS Device 2: Mac OS &amp; Tahoe\n💻 OS Device 3: Windows &lt;11&gt;'));
    assert.ok(softwarePurchaseNotification(order, 'txn', []).includes('💻 OS: Windows 11'));
});

test('mixed OS downloads include each platform and deduplicate shared URLs', () => {
    const links = { Windows: 'https://example.test/windows', macOS: 'https://example.test/mac', main: 'https://example.test/all' };
    assert.deepEqual(softwareDownloads(links, ['Windows 11', 'Mac OS Tahoe (26.0+)', 'Windows 10']), [
        { label: 'Windows', url: links.Windows }, { label: 'macOS', url: links.macOS },
    ]);
    assert.equal(softwareDownloads({ main: links.main }, ['Windows 11', 'Android']).length, 1);
});

test('checkout accepts catalog OS/source choices and rejects malformed required fields', () => {
    for (const os of SOFTWARE_OS_OPTIONS) assert.equal(validateSoftwareCheckout({ ...customer, os }, 1).customer.os, os);
    for (const source of SOFTWARE_SOURCES) assert.equal(validateSoftwareCheckout({ ...customer, source }, 1).customer.source, source);
    for (const value of [null, [], 'buyer']) assert.throws(() => validateSoftwareCheckout(value, 1), /invalid_customer/);
    for (const patch of [
        { name: '' }, { name: 'a'.repeat(101) }, { name: 'Budi\nInjected' },
        { mobile: '123' }, { mobile: '+62 8123456789' }, { mobile: '6281234567x' },
        { instagram: '' }, { instagram: '@@budi' }, { instagram: 'https://instagram.com/budi' },
        { os: 'Linux' }, { source: 'Unknown source' },
    ]) assert.throws(() => validateSoftwareCheckout({ ...customer, ...patch }, 1), /invalid_customer/);
});

test('email normalization excludes display names, recipient lists and control characters', () => {
    assert.equal(normalizeStoreEmail('  BUDI+Photo@Example.COM  '), 'budi+photo@example.com');
    for (const value of [null, '', 'Budi <budi@example.com>', 'budi@example.com,other@example.com',
        'budi@example.com\nBcc:other@example.com', 'budi example@example.com', 'budi@localhost']) {
        assert.throws(() => normalizeStoreEmail(value), /invalid_email/);
    }
});

test('receipt tokens require the supported high-entropy formats and stable hashes', () => {
    const base64 = 'a'.repeat(43);
    const hex = 'a'.repeat(64);
    assert.equal(validStoreToken(base64), true);
    assert.equal(validStoreToken(hex), true);
    assert.equal(validStoreToken('A'.repeat(64)), true);
    for (const token of [null, undefined, 123, '', 'a'.repeat(42), 'a'.repeat(44), 'g'.repeat(64), '/'.repeat(43)]) {
        assert.equal(validStoreToken(token), false);
    }
    assert.match(hashStoreToken(base64), /^[0-9a-f]{64}$/);
    assert.equal(hashStoreToken(base64), hashStoreToken(base64));
    assert.notEqual(hashStoreToken(base64), hashStoreToken('b'.repeat(43)));
});

test('downloads choose purchased OS and use the consolidated fallback', () => {
    const links = {
        Windows: 'https://downloads.example.com/windows', Android: 'https://downloads.example.com/android',
        macOS: 'https://downloads.example.com/mac', 'macOS-Monterey': 'https://downloads.example.com/monterey',
        main: 'https://downloads.example.com/all',
    };
    assert.deepEqual(softwareDownloads(links, 'Windows 11'), [{ label: 'Windows', url: links.Windows }]);
    assert.deepEqual(softwareDownloads(links, 'Android'), [{ label: 'Android', url: links.Android }]);
    assert.deepEqual(softwareDownloads(links, 'Mac OS Monterey (12.4+)'), [{ label: 'macOS-Monterey', url: links['macOS-Monterey'] }]);
    assert.deepEqual(softwareDownloads(links, 'Mac OS Tahoe (26.0+)'), [{ label: 'macOS', url: links.macOS }]);
    assert.deepEqual(softwareDownloads({ main: links.main }, 'Windows 11'), [{ label: 'RAW File Copy Tool', url: links.main }]);
    assert.deepEqual(softwareDownloads(null, null), []);
});

test('downloads reject scripts, plaintext transport, invalid URLs and embedded credentials', () => {
    for (const url of ['javascript:alert(1)', 'http://downloads.example.com/file', 'file:///tmp/file',
        'https://user:password@downloads.example.com/file', 'not a url']) {
        assert.deepEqual(softwareDownloads({ main: url }, null), []);
    }
});

test('Mayar payment checkout URLs enforce secure transport and provider hosts', () => {
    assert.equal(extractPaymentCheckoutUrl('https://ryaneko.myr.id/pay/123', 'production'), 'https://ryaneko.myr.id/pay/123');
    assert.equal(extractPaymentCheckoutUrl('https://web.mayar.io/pay/123', 'sandbox'), 'https://web.mayar.io/pay/123');
    assert.equal(extractPaymentCheckoutUrl('https://ryaneko.myr.id/pay/123', 'sandbox'), 'https://ryaneko.myr.id/pay/123');
    for (const url of [null, 'http://ryaneko.myr.id/pay', 'https://evilmyr.id/pay',
        'https://ryaneko.myr.id.evil.example/pay', 'https://web.mayar.id@evil.example/pay',
        'https://user:secret@ryaneko.myr.id/pay', 'javascript:alert(1)']) {
        assert.equal(extractPaymentCheckoutUrl(url, 'production'), null);
    }
    assert.equal(extractPaymentCheckoutUrl('https://web.mayar.io/pay/123', 'production'), null);
    assert.equal(extractPaymentCheckoutUrl('https://web.mayar.id/pay/123', 'sandbox'), null);
});

test('payment verification binds status, price, buyer, transaction and both order tags', () => {
    const order = { id: 'order-1', amount: 109000, customer_email: 'budi@example.com' };
    const attempt = { id: 'attempt-1', transaction_id: 'transaction-1' };
    const paid: MayarTransaction = {
        id: 'transaction-1', amount: 109000, status: 'paid', customer: { email: ' BUDI@example.com ' },
        extraData: { software_order_id: 'order-1', software_attempt_id: 'attempt-1' },
    };
    assert.equal(softwareTransactionMatches(order, attempt, paid), true);
    assert.equal(softwareTransactionMatches(order, { ...attempt, transaction_id: null }, paid), true);
    for (const patch of [
        { status: 'pending' }, { amount: 1 }, { id: 'another-transaction' },
        { customer: { email: 'other@example.com' } }, { customer: undefined }, { extraData: null },
        { extraData: { software_order_id: 'other-order', software_attempt_id: 'attempt-1' } },
        { extraData: { software_order_id: 'order-1', software_attempt_id: 'other-attempt' } },
        { extraData: { software_order_id: 'order-1' } },
    ]) assert.equal(softwareTransactionMatches(order, attempt, { ...paid, ...patch }), false);
});

test('provider redirect proof binds the entire receipt URL including its access fragment', () => {
    const receipt = 'https://ryanekoapp.web.id/after-buy/raw-file-copy-tool#orderId=order-1&token=secret';
    const hash = hashStoreToken(receipt);
    assert.equal(softwareRedirectMatches(hash, receipt), true);
    for (const provided of [undefined, null, '', receipt.split('#')[0], receipt.replace('secret', 'different'),
        receipt.replace('ryanekoapp.web.id', 'evil.example')]) {
        assert.equal(softwareRedirectMatches(hash, provided), false);
    }
    assert.equal(softwareRedirectMatches(null, receipt), false);
    assert.equal(softwareRedirectMatches('not-a-hash', receipt), false);
});
