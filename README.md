This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Subscription plan-change cron

Apply `migration/add-clientdesk-subscription-plan-changes.sql` to the Client Desk Supabase project, then configure `SUBSCRIPTION_CRON_SECRET`.

Run the protected endpoint every minute on the VPS:

```cron
* * * * * /root/ryaneko-license/scripts/run-subscription-plan-change-cron.sh >/dev/null
```

## Mayar hosted checkout

ClientDesk requests an immutable hosted checkout through Ryan Eko License so
the buyer's name, email, and mobile number are prefilled by Mayar. Configure
`MAYAR_API_KEY`, `MAYAR_ENV`, both Mayar product IDs, and the same
`RYANEKO_LICENSE_SERVICE_SECRET` in Ryan Eko License and ClientDesk.

Register the Mayar webhook using the protected path (not `/api/mayar/webhook`):

```text
https://license.ryanekoapp.web.id/api/mayar/webhook/<MAYAR_WEBHOOK_SECRET>
```

## Generic Windows fallback notifications

Apply `migration/add-generic-fallback-alert-claim.sql` to the license Supabase
database before deploying this change. Fallback alerts share a single atomic
claim per license across activation and verification. Existing licenses start
unclaimed. Device resets preserve the claim, and failed Telegram sends are not
retried automatically. Every fallback still writes its audit log and retains
the original device binding. If claiming fails (including a missing migration),
the server logs an error and skips the notification without rejecting the license.

## Getting Started

RAW File Copy Tool checkout and email/OTP history setup:
[software store rollout](docs/software-store-rollout.md). Apply its migration
before deploying the updated software webhook. New checkout defaults to disabled
until sandbox payment/redirect verification passes.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
