# RAW File Copy Tool checkout

The static Ryan Eko Web frontend uses `/api/store` on this license backend.
It collects buyer data and a server-priced package (1/2/3 devices at
Rp109,000/Rp196,000/Rp278,000), creates a Mayar Payment Request, and displays
downloads and serials only after verified, atomic fulfillment. These payments
remain RAW File Copy Tool in our database, but are Payment Requests in Mayar,
not sales attached to the existing digital product. Mayar channel/admin fees
are borne by the seller for this flow.

## Deployment order

For per-device OS, apply `migration/add-software-device-os.sql` after the base
store migration, deploy License, then deploy Web. The new `deviceOs` array must
match the package size; `os` retains its first entry for compatibility. Older
requests without the array still resume orders whose devices all share that OS.
Existing orders retain their original OS display; new orders record and display
each device in the receipt, history, and Telegram notification. Download links
cover the selected platforms without duplicates. Activation remains cross-OS.

1. Apply `migration/add-software-store.sql` to **Ryan Eko License Supabase**.
   This is also required by the old software webhook's atomic allocator.
   The migration is additive and does not allocate serials or change existing
   activation/device settings. It revokes browser-role access to licenses and
   purchases so clients cannot bypass email verification with direct database
   reads; all existing app routes use service-role access. Back up the database
   using the usual workflow and inspect any external direct-database clients
   before applying the permission changes.
2. Configure `SOFTWARE_STORE_SECRET` with an independent random secret,
   `SOFTWARE_STORE_WEB_URL`, and `SOFTWARE_STORE_ALLOWED_ORIGINS` (comma-separated
   exact origins). Keep `SOFTWARE_STORE_ENABLED=false` initially.
3. Deploy the backend. Existing subscription checkout integrations are unchanged.
4. Test with **valid sandbox Mayar credentials**. The supplied local configuration
   returned HTTP 401 on a read-only sandbox credential check; no provider payment
   creation or browser payment completion has been proven in this implementation.
5. Verify Payment Request creation echoes the exact `redirectUrl`, including its
   fragment, and a completed sandbox payment actually returns to the receipt.
   Verify `extraData.software_order_id` and `software_attempt_id` survive into the
   transaction detail API. The code fails closed when redirect support is absent.
   Do not remove this check or silently fall back to an unbound payment link.
6. Verify pending/retry, expiration/regeneration, edits closing the old request,
   serial fulfillment, email receipt, and real OTP delivery in sandbox.
7. Enable `SOFTWARE_STORE_ENABLED=true` in the intended backend environment.
   Set `NEXT_PUBLIC_SOFTWARE_STORE_ENABLED=true` and the backend `/api/store` URL
   in the web build, then publish that static build. The default web flag retains
   the existing Mayar product checkout button until these checks pass.

Production migration and deployment are separate from preparing these files.
Do not treat a local build, mocked provider response, or a prepared migration as
proof of production behavior.

## Access and recovery

- `/purchase-history`: email + single-use six-digit OTP (10 minutes, five attempts,
  60-second resend minimum, five requests/email/hour, twenty requests/IP/hour).
  Verified history sessions last 30 minutes. Email lookup never reveals whether
  a buyer exists before verification; valid addresses receive the same OTP flow.
- Receipt access: random 256-bit browser capability and independent email
  capability; only hashes are stored, with a 90-day access lifetime. Fragment
  access is removed from the address bar. Email OTP can reopen old purchases
  after capability expiry. There is no order-code search.
- New order tables/RPCs are service-role only. CORS on `/api/store` uses configured
  origins and sensitive responses have `no-store`.
- Public-to-checkout/receipt navigation is a full page load. Tracker and recorder
  scripts are excluded on checkout, RAW receipt and history pages.
- A provider timeout remains uncertain. Reconciliation searches at most 200
  recent Payment Requests for the exact attempt metadata, then verifies the
  transaction. If no proof is found, do not blindly regenerate a payment:
  an operator must reconcile the provider record before retiring the attempt.
- Provider expiration/closure is verified before regeneration. A superseded
  checkout is permanently fenced against retries from an older browser tab.
  Late payment is still processed; a second paid attempt must be reviewed by an
  operator rather than allocating another set of serials.
- Stock shortage leaves a paid order awaiting stock, with no partial allocation.
  Replenish stock, then use a receipt/history refresh or webhook retry.
- Email delivery is separate from fulfillment and can retry without reserving
  more serials. Existing legacy purchases are treated as already emailed; new
  allocations track delivery and retry failed delivery independently.
- Legacy history shows only RAW purchases stored in this database, merges new
  orders without duplicates, and labels missing historical payment information
  as unavailable rather than inventing a payment status.

## Local checks

```sh
npm test
npm run lint
npm run build
npm install --prefix /tmp/store-db --no-audit --no-fund @electric-sql/pglite
node scripts/test-software-store-db.mjs /tmp/store-db/node_modules/@electric-sql/pglite/dist/index.js
node --experimental-strip-types scripts/test-software-store-service.mjs /tmp/store-db/node_modules/@electric-sql/pglite/dist/index.js
```

Database tests execute the actual migration and RPCs in an isolated PostgreSQL
runtime. Service integration tests route all HTTP to test adapters and block
unexpected hosts. They prove application/SQL behavior with simulated provider
and mail responses; multi-connection PostgreSQL load and live Mayar redirects
still require the sandbox rollout checks above.

Provider contracts: [Payment Request](https://docs.mayar.id/api-reference-v2/reqpayment/create),
[transaction detail](https://docs.mayar.id/api-reference-v2/transaction/detail),
[payment closure](https://docs.mayar.id/api-reference-v2/reqpayment/changestatus).
