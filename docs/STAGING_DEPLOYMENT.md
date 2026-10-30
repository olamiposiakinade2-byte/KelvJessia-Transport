# Staged production booking deployment

The public website remains in `demo` mode unless a server environment gate is
explicitly enabled. No real customer reservation can be created from the live
Vercel domain with the repository defaults.

## Required staging setup

1. Create a protected Supabase database branch or another isolated staging
   project. Apply `database/002_production_booking_schema.sql`, then
   `database/003_booking_payments_operations.sql`, in that order and there
   only. Do not apply `001_initial_schema.sql` to this baseline.
2. Create at least one authorized staff account in Supabase Auth, then set that
   account's existing `public.user_roles.role` to `admin` through a reviewed
   server-side operation. Do not give browser users direct table permissions.
3. In the Vercel project's **Preview** environment, set these encrypted values:

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BOOKING_RATE_LIMIT_SALT` (a high-entropy secret)
   - `KELVJESSIA_BOOKINGS_MODE=staging`
   - `KELVJESSIA_STAGING_PROTECTED=true`
   - `TURNSTILE_SECRET_KEY` and matching site key, if bot protection is enabled
   - `KELVJESSIA_PAYMENTS_TEST_MODE=true`
   - `PAYSTACK_SECRET_KEY` using a Paystack **test** secret key only
   - `PAYSTACK_CALLBACK_URL=https://<protected-preview-domain>/payment.html`
   - `CRON_SECRET` (a distinct high-entropy secret for Vercel Cron)

4. Enable Vercel Deployment Protection for the preview/staging deployment.
   Add the preview domain to Supabase Auth redirect URLs if staff will sign in
   there.
5. In the Paystack dashboard, set the staging webhook to
   `https://<protected-preview-domain>/api/payments/paystack-webhook`. Add only
   fictional vehicles, drivers, trips, and customer records to staging.

6. Configure the Vercel Cron route declared in `vercel.json`. It calls the
   protected expiry endpoint every five minutes. The database also checks
   expiry in every seat-allocation/payment transaction, so closing a browser
   cannot retain a seat indefinitely.

## Production promotion gate

Production remains disabled until the company has approved real booking intake.
Only then set all of the following in Vercel Production:

```text
KELVJESSIA_BOOKINGS_MODE=live
KELVJESSIA_REAL_BOOKING_APPROVED=true
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BOOKING_RATE_LIMIT_SALT=...
TURNSTILE_SECRET_KEY=...
```

Keep the service-role key encrypted and server-only. The browser must never
receive it. Before promotion, apply the reviewed migration to production, run
the Supabase security advisors, verify RLS, and test cancellation, concurrent
final-seat requests, payment initialization, webhook replay, late-payment
recovery/refund workflow, enquiry access controls, driver event permissions,
exports, logout, and WhatsApp handoff.
