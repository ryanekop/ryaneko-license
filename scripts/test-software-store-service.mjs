// Isolated service integration tests. Provider, mail and Supabase HTTP are mocked;
// real PostgreSQL functions execute in PGlite. No network request escapes this file.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://store-db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
process.env.MAYAR_API_KEY = 'isolated-test-key';
process.env.MAYAR_ENV = 'sandbox';
process.env.MAYAR_V2_API_BASE_URL = 'https://provider.test/hl/v2';
process.env.RESEND_API_KEY = 'isolated-test-key';
process.env.SOFTWARE_STORE_ENABLED = 'true';
process.env.SOFTWARE_STORE_SECRET = 'isolated-test-secret';
process.env.SOFTWARE_STORE_WEB_URL = 'https://ryanekoapp.web.id';
process.env.TELEGRAM_BOT_TOKEN = 'isolated-test-bot';
process.env.TELEGRAM_CHAT_ID = 'isolated-test-chat';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const payments = new Map();
const transactions = new Map();
const mails = [];
const telegramMessages = [];
const paymentRequests = [];
let creates = 0;
let mailFails = false;
let createMode = 'normal';
const metadataFormat = process.argv[3] || 'json-text';
assert.ok(['object', 'json-text'].includes(metadataFormat));
const metadata = value => metadataFormat === 'json-text' && value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
const providerTransaction = transaction => ({ ...transaction, extraData: metadata(transaction.extraData) });
const providerPayment = payment => ({
    ...payment, extraData: metadata(payment.extraData),
    transactions: payment.transactions.map(transaction => ({ id: transaction.id, extraData: metadata(transaction.extraData) })),
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const ident = value => { assert.match(value, /^[a-z_][a-z0-9_]*$/); return `"${value}"`; };

async function rest(url, init) {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.pathname.includes('/rpc/')) {
        const name = url.pathname.split('/').at(-1);
        const names = Object.keys(body);
        const result = await db.query(`SELECT ${ident(name)}(${names.map((name, i) => `${ident(name)} => $${i + 1}`).join(',')}) AS result`, Object.values(body));
        return json(result.rows[0].result);
    }
    const table = ident(url.pathname.split('/').at(-1));
    const params = [];
    const where = [];
    for (const [column, filter] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(column)) continue;
        const [operator, ...rest] = filter.split('.');
        const value = rest.join('.');
        const col = ident(column);
        if (operator === 'not' && value.startsWith('in.')) {
            params.push(value.slice(4, -1).split(',')); where.push(`${col} <> ALL($${params.length}::text[])`);
        } else if (operator === 'in') {
            params.push(value.slice(1, -1).split(',')); where.push(`${col}::text = ANY($${params.length}::text[])`);
        } else {
            assert.ok(['eq', 'neq', 'gt', 'ilike', 'is'].includes(operator), filter);
            if (operator === 'is') { assert.equal(value, 'null'); where.push(`${col} IS NULL`); }
            else { params.push(value); where.push(`${col} ${ { eq: '=', neq: '<>', gt: '>', ilike: 'ILIKE' }[operator]} $${params.length}`); }
        }
    }
    const columns = url.searchParams.get('select') || '*';
    const projection = columns === '*' ? '*' : columns.split(',').map(ident).join(',');
    let sql;
    if (init.method === 'PATCH') {
        const set = Object.entries(body).map(([key, value]) => { params.push(value); return `${ident(key)} = $${params.length}`; });
        sql = `UPDATE ${table} SET ${set.join(',')} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} RETURNING ${projection}`;
    } else {
        sql = `SELECT ${projection} FROM ${table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
        const order = url.searchParams.get('order');
        if (order) sql += ' ORDER BY ' + order.split(',').map(item => { const [field, direction] = item.split('.'); return `${ident(field)} ${direction === 'desc' ? 'DESC' : 'ASC'}`; }).join(',');
        if (url.searchParams.has('limit')) { params.push(Number(url.searchParams.get('limit'))); sql += ` LIMIT $${params.length}`; }
    }
    const result = await db.query(sql, params);
    const accept = new Headers(init.headers).get('accept') || '';
    return accept.includes('vnd.pgrst.object') ? result.rows[0] ? json(result.rows[0]) : json({ code: 'PGRST116', details: '0 rows' }, 406) : json(result.rows);
}

globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
    if (url.hostname === 'store-db.test') {
        try { return await rest(url, init); } catch (error) { return json({ code: error.code || 'TEST', message: error.message }, 400); }
    }
    if (url.hostname === 'api.resend.com') {
        const mail = JSON.parse(init.body); mails.push(mail);
        return mailFails ? json({ message: 'test mail failure' }, 503) : json({ id: randomUUID() });
    }
    if (url.hostname === 'api.telegram.org') {
        assert.equal(url.pathname, '/botisolated-test-bot/sendMessage');
        const message = JSON.parse(init.body);
        assert.equal(message.chat_id, 'isolated-test-chat');
        assert.equal(message.parse_mode, 'HTML');
        telegramMessages.push(message.text);
        return json({ ok: true });
    }
    assert.equal(url.hostname, 'provider.test', 'Unexpected network request blocked');
    if (url.pathname.endsWith('/payments/create')) {
        creates++;
        const request = JSON.parse(init.body);
        paymentRequests.push(request);
        const id = randomUUID(), transactionId = randomUUID();
        const transaction = { id: transactionId, amount: request.amount, status: 'unpaid', customer: { email: request.email }, extraData: request.extraData, expirationDate: Date.parse(request.expiredAt) };
        const payment = { id, transactionId, status: 'active', link: `https://web.mayar.io/pl/test-${id}`, redirectUrl: createMode === 'bad-redirect' ? null : request.redirectUrl, extraData: request.extraData, transactions: [transaction] };
        payments.set(id, payment); transactions.set(transactionId, transaction);
        if (createMode === 'timeout') throw new Error('Simulated provider timeout after committed create');
        return json({ statusCode: 200, data: payment });
    }
    if (url.pathname.endsWith('/payments')) return json({ statusCode: 200, data: [...payments.values()].map(providerPayment), hasMore: false });
    const segments = url.pathname.split('/');
    if (segments.at(-2) === 'transactions') return json({ statusCode: 200, data: providerTransaction(transactions.get(segments.at(-1))) });
    const id = segments.at(-1) === 'close' ? segments.at(-2) : segments.at(-1);
    const payment = payments.get(id);
    assert.ok(payment, 'Unknown test payment');
    if (segments.at(-1) === 'close') {
        payment.status = 'closed'; transactions.get(payment.transactionId).status = 'closed';
        return json({ statusCode: 200, messages: 'success' });
    }
    return json({ statusCode: 200, data: providerPayment(payment) });
};

try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE TABLE products(id uuid PRIMARY KEY,slug text UNIQUE,name text,download_urls jsonb);
        CREATE TABLE licenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid,serial_key text UNIQUE,status text DEFAULT 'available',customer_name text,customer_email text,customer_instagram text,order_id text,batch_info text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
        CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id text UNIQUE,product_id uuid,customer_name text,customer_email text,customer_instagram text,license_count integer,includes_plugin boolean,addons jsonb,raw_payload jsonb,licenses_assigned uuid[],created_at timestamptz DEFAULT now());
        INSERT INTO products VALUES ('00000000-0000-0000-0000-000000000001','raw-file-copy-tool','RAW File Copy Tool','{"main":"https://example.test/download","Windows":"https://example.test/windows","macOS":"https://example.test/mac"}');
        INSERT INTO licenses(product_id,serial_key) SELECT '00000000-0000-0000-0000-000000000001','SERIAL-'||n FROM generate_series(1,20)n;`);
    await db.exec(await readFile(new URL('../migration/add-software-store.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../migration/add-software-device-os.sql', import.meta.url), 'utf8'));
    const store = await import('../src/lib/software-store.ts');
    const mayar = await import('../src/lib/mayar-v2.ts');
    const buyer = { name: 'Buyer <Photo> & Friends', email: 'buyer@example.test', mobile: '081234567890', instagram: 'buyer', os: 'Windows 11', source: 'Website' };
    const token = () => randomBytes(32).toString('base64url');
    const access = token();
    const mixedBuyer = { ...buyer, deviceOs: [buyer.os, 'Mac OS Tahoe (26.0+)'] };
    const checkout = await store.createSoftwareCheckout(mixedBuyer, 2, access);
    assert.equal(creates, 1);
    assert.equal(paymentRequests[0].name, buyer.name);
    assert.ok(paymentRequests[0].description.includes('RAW File Copy Tool; 2 device;'));
    assert.equal((await store.createSoftwareCheckout(mixedBuyer, 2, access)).checkoutUrl, checkout.checkoutUrl);
    assert.equal(creates, 1);
    await assert.rejects(store.getSoftwareReceipt(checkout.orderId, token(), false), /invalid_access/);
    const pending = await store.getSoftwareReceipt(checkout.orderId, access, false);
    assert.equal(pending.serials.length, 0);
    assert.deepEqual(pending.deviceOs, mixedBuyer.deviceOs);
    console.log('PASS: actual service creates and reuses checkout; invalid receipt token denied');
    const payment = [...payments.values()][0];
    const transaction = transactions.get(payment.transactionId);
    transaction.status = 'paid'; mailFails = true;
    // Same transaction-read boundary used by the verified webhook.
    assert.equal(await store.processSoftwareStoreTransaction(await mayar.getMayarTransaction(transaction.id)), true);
    const fulfilled = await store.getSoftwareReceipt(checkout.orderId, access, false);
    assert.equal(fulfilled.status, 'fulfilled'); assert.equal(fulfilled.serials.length, 2);
    assert.deepEqual(fulfilled.deviceOs, mixedBuyer.deviceOs);
    assert.deepEqual(fulfilled.downloads.map(item => item.url), ['https://example.test/windows', 'https://example.test/mac']);
    const purchaseMessages = () => telegramMessages.filter(message => message.includes('<b>New Purchase! v2</b>'));
    assert.equal(purchaseMessages().length, 1);
    for (const content of [
        'RAW File Copy Tool', 'Buyer &lt;Photo&gt; &amp; Friends', buyer.email, buyer.mobile,
        `Instagram: ${buyer.instagram}`, `OS Device 1: ${buyer.os}`, 'OS Device 2: Mac OS Tahoe (26.0+)', `Sumber: ${buyer.source}`,
        'Rp 196.000', 'Jumlah lisensi: 2', checkout.orderId, transaction.id,
        ...fulfilled.serials.map(serial => `<code>${serial}</code>`),
    ]) assert.ok(purchaseMessages()[0].includes(content), content);
    assert.ok(!purchaseMessages()[0].includes('Buyer <Photo>'));
    assert.equal((await db.query('SELECT email_status FROM software_orders WHERE id=$1', [checkout.orderId])).rows[0].email_status, 'failed');
    mailFails = false;
    await db.query("UPDATE software_orders SET email_claimed_at=now()-interval '61 seconds' WHERE id=$1", [checkout.orderId]);
    await store.processSoftwareStoreTransaction(await mayar.getMayarTransaction(transaction.id));
    assert.equal((await db.query('SELECT email_status FROM software_orders WHERE id=$1', [checkout.orderId])).rows[0].email_status, 'sent');
    assert.ok(mails.at(-1).html.includes(`href="https://ryanekoapp.web.id/after-buy/raw-file-copy-tool#orderId=${checkout.orderId}&amp;token=`), 'multi-platform email download opens all downloads in the receipt');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1',[transaction.id])).rows[0].count, 2);
    await store.getSoftwareReceipt(checkout.orderId, access, true);
    assert.equal(purchaseMessages().length, 1, 'duplicate webhook/email retry/receipt refresh must not resend purchase notification');
    console.log('PASS: verified fulfillment, duplicate webhook, failed email then retry without new serials');
    const duplicateId = randomUUID(), duplicateTxn = randomUUID();
    await db.query('INSERT INTO software_payment_attempts(id,order_id,transaction_id,status,expires_at) VALUES ($1,$2,$3,\'pending\',now()+interval \'1 day\')', [duplicateId, checkout.orderId, duplicateTxn]);
    const duplicatePayment = { ...transaction, id: duplicateTxn, extraData: { software_order_id: checkout.orderId, software_attempt_id: duplicateId } };
    transactions.set(duplicateTxn, duplicatePayment);
    assert.equal(await store.processSoftwareStoreTransaction(await mayar.getMayarTransaction(duplicateTxn)), true);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1',[duplicateTxn])).rows[0].count, 0);
    assert.ok((await db.query('SELECT duplicate_payment_notified_at FROM software_orders WHERE id=$1',[checkout.orderId])).rows[0].duplicate_payment_notified_at);
    assert.equal(purchaseMessages().length, 1, 'second payment must not emit another fulfilled purchase notification');
    console.log('PASS: second paid attempt is flagged for review without additional serial allocation');

    await store.requestSoftwareOtp(buyer.email, 'test-ip');
    const otp = mails.at(-1).html.match(/>(\d{6})<\/p>/)[1];
    const session = await store.verifySoftwareOtp(buyer.email, otp);
    await assert.rejects(store.verifySoftwareOtp(buyer.email, otp), /invalid_otp/);
    const history = await store.getSoftwareHistory(session.sessionToken, 1);
    assert.equal(history.orders.length, 1);
    assert.equal(history.orders[0].serials.length, 0);
    assert.deepEqual(history.orders[0].deviceOs, mixedBuyer.deviceOs);
    assert.equal((await store.getSoftwareHistoryDetail(session.sessionToken, checkout.orderId)).serials.length, 2);
    await store.requestSoftwareOtp('other@example.test', 'other-ip');
    const otherOtp = mails.at(-1).html.match(/>(\d{6})<\/p>/)[1];
    const other = await store.verifySoftwareOtp('other@example.test', otherOtp);
    await assert.rejects(store.getSoftwareHistoryDetail(other.sessionToken, checkout.orderId), /invalid_access/);
    console.log('PASS: real OTP/service/database roundtrip; history session cannot cross buyer boundaries');

    const oldAccess = token();
    const old = await store.createSoftwareCheckout(buyer, 1, oldAccess);
    const newAccess = token();
    const replacement = await store.createSoftwareCheckout(buyer, 3, newAccess, oldAccess);
    assert.notEqual(old.orderId, replacement.orderId);
    assert.equal((await db.query('SELECT superseded_at FROM software_orders WHERE id=$1',[old.orderId])).rows[0].superseded_at !== null, true);
    await assert.rejects(store.createSoftwareCheckout(buyer, 1, oldAccess));
    console.log('PASS: edited checkout closes and permanently retires old order');

    createMode = 'timeout';
    const uncertainAccess = token(); const beforeTimeout = creates;
    await assert.rejects(store.createSoftwareCheckout(buyer, 1, uncertainAccess), /payment_pending_reconciliation/);
    createMode = 'normal';
    await db.query("UPDATE software_payment_attempts SET created_at=now()-interval '31 seconds' WHERE order_id=(SELECT id FROM software_orders WHERE access_token_hash=$1)", [store.hashStoreToken(uncertainAccess)]);
    const recovered = await store.createSoftwareCheckout(buyer, 1, uncertainAccess);
    assert.ok(recovered.checkoutUrl); assert.equal(creates, beforeTimeout+1);
    console.log('PASS: committed provider timeout reconciles instead of making a duplicate payment');

    const recheckAccess = token();
    const recheck = await store.createSoftwareCheckout(buyer, 1, recheckAccess);
    const recheckPayment = [...payments.values()].find(item => item.extraData.software_order_id === recheck.orderId);
    const recheckTransaction = transactions.get(recheckPayment.transactionId);
    recheckTransaction.status = 'paid';
    const originalMetadata = recheckTransaction.extraData;
    for (const invalid of ['{broken', '[]', 'null', '123', [], { ...originalMetadata, software_order_id: randomUUID() }, { ...originalMetadata, software_attempt_id: randomUUID() }]) {
        recheckTransaction.extraData = invalid;
        await db.query('UPDATE software_orders SET last_verified_at=NULL WHERE id=$1', [recheck.orderId]);
        await assert.rejects(store.getSoftwareReceipt(recheck.orderId, recheckAccess, true), /payment_verification_failed/);
        assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1', [recheckTransaction.id])).rows[0].count, 0);
    }
    recheckTransaction.extraData = originalMetadata;
    await db.query('UPDATE software_orders SET last_verified_at=NULL WHERE id=$1', [recheck.orderId]);
    const rechecked = await store.getSoftwareReceipt(recheck.orderId, recheckAccess, true);
    assert.equal(rechecked.status, 'fulfilled'); assert.equal(rechecked.serials.length, 1);
    const notificationCount = purchaseMessages().length;
    const deliveredCount = mails.length;
    assert.deepEqual((await store.getSoftwareReceipt(recheck.orderId, recheckAccess, true)).serials, rechecked.serials);
    assert.equal(mails.length, deliveredCount);
    assert.equal(purchaseMessages().length, notificationCount);
    console.log('PASS: receipt refresh recovers paid order, rejects invalid metadata, and remains idempotent');

    createMode = 'bad-redirect';
    await assert.rejects(store.createSoftwareCheckout(buyer, 1, token()), /payment_redirect_unsupported/);
    console.log('PASS: missing provider redirect fails closed');
    console.log('PASS: service scenarios with provider metadata format:', metadataFormat);
} catch (error) {
    console.error(error.message, error.stack?.split('\n').slice(1,4).join('\n'));
    process.exitCode = 1;
} finally { await db.close(); }
