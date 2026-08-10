# Ryaneko License admin and ClientDesk MFA recovery rollout

1. In Ryaneko Supabase Auth, disable public signup and manually create each admin account.
2. Put the exact admin UUIDs in `RYANEKO_ADMIN_USER_IDS`.
3. Deploy, sign in, and enroll two TOTP factors on different devices/password managers. The API guard rejects admin access with fewer than two verified factors.
4. Run `supabase_migration_admin_security_events.sql` in the Ryaneko database.
5. Confirm `CLIENTDESK_SUPABASE_URL` and `CLIENTDESK_SUPABASE_SERVICE_KEY` point to ClientDesk. Never expose the service key to the browser.
6. Verify Resend and Telegram environment variables, then test reset using a non-production account.
7. Deploy the ClientDesk recovery-enforcement migration before enabling the reset button for production operators.

Every admin API request requires an allowlisted Supabase user at AAL2. Mutations also require same-origin and the Ryaneko CSRF header. A 2FA reset requires a TOTP verification no more than five minutes old, exact target-email confirmation, and a reason.

If a Ryaneko admin loses both factors, there is no web bypass. On a trusted local machine with `.env.local`, run:

```sh
npm run admin:break-glass-mfa -- <admin-user-uuid> RESET-<admin-user-uuid>
```

Afterward, the admin login gate forces enrollment of two new TOTP factors.
