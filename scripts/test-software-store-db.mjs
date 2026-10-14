// Run with a temporary PGlite installation; no production connection is used.
// node scripts/test-software-store-db.mjs /tmp/store-db/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
    await db.exec(`
        CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE TABLE products (id uuid PRIMARY KEY, slug text UNIQUE);
        CREATE TABLE licenses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES products(id),
            serial_key text UNIQUE NOT NULL, status text DEFAULT 'available', customer_name text,
            customer_email text, customer_instagram text, order_id text, batch_info text,
            created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );
        CREATE TABLE purchases (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id text UNIQUE NOT NULL,
            product_id uuid REFERENCES products(id), customer_name text NOT NULL, customer_email text NOT NULL,
            customer_instagram text, license_count integer, includes_plugin boolean, addons jsonb,
            raw_payload jsonb, licenses_assigned uuid[], created_at timestamptz DEFAULT now()
        );
        INSERT INTO products VALUES ('00000000-0000-0000-0000-000000000001', 'raw-file-copy-tool');
        INSERT INTO licenses (product_id, serial_key) SELECT '00000000-0000-0000-0000-000000000001', 'TEST-' || n FROM generate_series(1, 8) n;
        GRANT ALL ON licenses, purchases TO anon, authenticated;
    `);
    const migration = await readFile(new URL('../migration/add-software-store.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Deployment reruns are safe.
    const customer = { name: 'Buyer', email: 'buyer@example.test', mobile: '+628123456789', instagram: 'buyer', os: 'Windows 11', source: 'Website' };
    const checkout = async (token, count = 2, buyer = customer) => (await db.query(
        'SELECT begin_software_checkout($1, $2::jsonb, $3, $4, now() + interval \'24 hours\') AS result',
        [token.repeat(64), JSON.stringify(buyer), count, [0, 109000, 196000, 278000][count]],
    )).rows[0].result;
    const one = await checkout('a');
    const repeated = await checkout('a');
    assert.equal(repeated.order.id, one.order.id);
    assert.equal(repeated.attempt.id, one.attempt.id);
    assert.equal(repeated.created, false);
    await assert.rejects(checkout('a', 3), /selection changed/);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id IS NOT NULL')).rows[0].count, 0);
    console.log('PASS: checkout idempotency, changed selection rejection, no prepayment allocation');

    const fulfill = async (order, transaction, amount = order.order.amount, email = customer.email) => (await db.query(
        'SELECT fulfill_software_order($1,$2,$3,$4,$5,$6::jsonb) AS result',
        [order.order.id, order.attempt.id, transaction, amount, email, '{}'],
    )).rows[0].result;
    await assert.rejects(fulfill(one, 'txn-1', 1), /Payment mismatch/);
    await assert.rejects(fulfill(one, 'txn-1', 196000, 'other@example.test'), /Payment mismatch/);
    const paid = await fulfill(one, 'txn-1');
    assert.equal(paid.order.status, 'fulfilled');
    assert.equal(paid.newly_fulfilled, true);
    assert.equal((await fulfill(one, 'txn-1')).newly_fulfilled, false);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1', ['txn-1'])).rows[0].count, 2);
    console.log('PASS: payment mismatch rejection and duplicate fulfillment reuse');

    await db.query('SELECT fulfill_legacy_software_purchase($1,$2,1,$3,$4,NULL,false,\'[]\',\'{}\')', ['00000000-0000-0000-0000-000000000001', 'legacy-1', 'Legacy', 'legacy@example.test']);
    await db.query('SELECT fulfill_legacy_software_purchase($1,$2,1,$3,$4,NULL,false,\'[]\',\'{}\')', ['00000000-0000-0000-0000-000000000001', 'legacy-1', 'Legacy', 'legacy@example.test']);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1', ['legacy-1'])).rows[0].count, 1);
    assert.equal((await db.query('SELECT claim_legacy_software_email($1) AS claimed', ['legacy-1'])).rows[0].claimed, true);
    assert.equal((await db.query('SELECT claim_legacy_software_email($1) AS claimed', ['legacy-1'])).rows[0].claimed, false);
    await db.query("UPDATE purchases SET license_email_status='failed' WHERE order_id='legacy-1'");
    assert.equal((await db.query('SELECT claim_legacy_software_email($1) AS claimed', ['legacy-1'])).rows[0].claimed, true);
    const emailClaim = await db.query('SELECT claim_software_email($1,$2) AS claimed', [one.order.id, 'email-hash']);
    assert.equal(emailClaim.rows[0].claimed, true);
    assert.equal((await db.query('SELECT claim_software_email($1,$2) AS claimed', [one.order.id, 'email-hash'])).rows[0].claimed, false);
    console.log('PASS: legacy allocation reuse and independent email delivery claims');

    const two = await checkout('b', 3);
    assert.equal((await fulfill(two, 'txn-2')).order.status, 'fulfilled');
    const three = await checkout('c', 3);
    assert.equal((await fulfill(three, 'txn-3')).order.status, 'awaiting_stock');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM licenses WHERE order_id=$1', ['txn-3'])).rows[0].count, 0);
    await db.exec("INSERT INTO licenses(product_id,serial_key) VALUES ('00000000-0000-0000-0000-000000000001','REPLENISHED')");
    assert.equal((await fulfill(three, 'txn-3')).order.status, 'fulfilled');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM purchases')).rows[0].count, 4);
    console.log('PASS: stock shortage is atomic and retry recovers the same order');

    let history = (await db.query('SELECT software_purchase_history($1,1) AS result', [customer.email])).rows[0].result;
    assert.equal(history.orders.length, 3);
    assert.equal(history.orders.every(order => order.kind === 'checkout' && order.serials.length === 0), true);
    await db.query(`INSERT INTO purchases(order_id, product_id, customer_name, customer_email, license_count, licenses_assigned, raw_payload)
        SELECT 'old-' || n, '00000000-0000-0000-0000-000000000001', 'Buyer', $1, 1, '{}',
            CASE WHEN n=1 THEN '{"data":{"status":"paid","amount":109000}}'::jsonb ELSE '{}'::jsonb END
        FROM generate_series(1,25) n`, [customer.email.toUpperCase()]);
    history = (await db.query('SELECT software_purchase_history($1,1) AS result', [customer.email])).rows[0].result;
    assert.equal(history.orders.length, 20);
    assert.equal(history.hasMore, true);
    const history2 = (await db.query('SELECT software_purchase_history($1,2) AS result', [customer.email])).rows[0].result;
    assert.equal(history2.orders.length, 8);
    assert.equal(history2.hasMore, false);
    assert.equal(new Set([...history.orders, ...history2.orders].map(order => order.id)).size, 28);
    assert.equal([...history.orders, ...history2.orders].filter(order => order.paymentStatusKnown === false).length, 24);
    assert.equal((await db.query('SELECT software_purchase_history($1,1) AS result', ['stranger@example.test'])).rows[0].result.orders.length, 0);
    console.log('PASS: history pagination, case-insensitive email, merged deduplication, unknown legacy status');

    const restart = await checkout('d', 1);
    await db.query("UPDATE software_payment_attempts SET status='uncertain' WHERE id=$1", [restart.attempt.id]);
    assert.equal((await checkout('d', 1)).created, false);
    await db.query("UPDATE software_payment_attempts SET status='expired' WHERE id=$1", [restart.attempt.id]);
    const renewed = await checkout('d', 1);
    assert.equal(renewed.created, true);
    assert.equal(renewed.order.id, restart.order.id);
    assert.notEqual(renewed.attempt.id, restart.attempt.id);
    await db.query('UPDATE software_orders SET superseded_at=now() WHERE id=$1', [restart.order.id]);
    await assert.rejects(checkout('d', 1), /Checkout superseded/);
    console.log('PASS: uncertain payment cannot regenerate, expired payment can');

    const otp = async (email, ip, hash) => (await db.query('SELECT begin_software_otp($1,$2,$3) AS result', [email, ip, hash])).rows[0].result;
    const verify = async (email, hash, session) => (await db.query('SELECT verify_software_otp($1,$2,$3) AS result', [email, hash, session])).rows[0].result;
    assert.equal((await otp(customer.email, 'ip1', 'correct')).allowed, true);
    assert.equal((await otp(customer.email, 'ip2', 'new')).allowed, false);
    for (let i = 0; i < 5; i++) assert.equal((await verify(customer.email, 'wrong', `session${i}`)).verified, false);
    assert.equal((await verify(customer.email, 'correct', 'locked')).verified, false);
    await db.query("UPDATE software_otp_requests SET created_at=now()-interval '61 seconds'");
    assert.equal((await otp(customer.email, 'ip1', 'correct')).allowed, true);
    const session = await verify(customer.email, 'correct', 'valid-session');
    assert.equal(session.verified, true);
    assert.equal((await verify(customer.email, 'correct', 'replayed')).verified, false);
    assert.equal((await db.query('SELECT email FROM software_history_sessions WHERE token_hash=$1', ['valid-session'])).rows[0].email, customer.email);
    await otp('expired@example.test', 'ip1', 'expired');
    await db.exec("UPDATE software_otp_challenges SET expires_at=now()-interval '1 second' WHERE email='expired@example.test'");
    assert.equal((await verify('expired@example.test', 'expired', 'expired-session')).verified, false);
    for (let i = 0; i < 17; i++) await otp(`rate${i}@example.test`, 'ip1', 'rate');
    assert.equal((await otp('limited@example.test', 'ip1', 'rate')).allowed, false);
    console.log('PASS: durable OTP resend/rate limits, lockout, expiry, single-use sessions');

    assert.equal((await db.query("SELECT has_table_privilege('anon','software_orders','SELECT') AS allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_table_privilege('anon','licenses','SELECT') AS allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','purchases','SELECT') AS allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','verify_software_otp(text,text,text)','EXECUTE') AS allowed")).rows[0].allowed, false);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM software_orders'), /permission denied/);
    await db.exec('RESET ROLE');
    console.log('PASS: browser roles cannot access store tables or privileged RPCs');
} catch (error) {
    console.error(error.message, error.detail || '', error.where || '', error.position || '', error.internalQuery || '');
    process.exitCode = 1;
} finally {
    await db.close();
}
