# Ryaneko License admin and ClientDesk MFA recovery rollout

1. Set a strong `ADMIN_PASSWORD` for the Ryaneko admin panels.
2. Optionally set a separate long random `ADMIN_SESSION_SECRET`. When omitted, session cookies are signed with `ADMIN_PASSWORD`.
3. Run `supabase_migration_admin_security_events.sql` in the Ryaneko database.
4. Confirm `CLIENTDESK_SUPABASE_URL` and `CLIENTDESK_SUPABASE_SERVICE_KEY` point to ClientDesk. Never expose the service key to the browser.
5. Verify Resend and Telegram environment variables, then test reset using a non-production account.
6. Deploy the ClientDesk recovery-enforcement migration before enabling the reset button for production operators.

Admin access uses the shared legacy password and a signed, HTTP-only session cookie that expires after 12 hours. Admin API requests require a valid session and same-origin browser request. The Mayar ClientDesk backfill endpoint also accepts the legacy password through `X-Admin-Password` or a bearer token for programmatic use.

A ClientDesk 2FA reset requires the exact target email, a reason, and re-entry of the legacy admin password. Reset events are recorded under the fixed `legacy-admin` audit identity.
