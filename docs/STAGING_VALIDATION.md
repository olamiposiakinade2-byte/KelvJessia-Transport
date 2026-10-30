# Protected staging validation runbook

This runbook is for an isolated **staging** database and a Vercel Preview
deployment only. Use fictional passengers, vehicles, drivers, and enquiries.
Do not set production variables or use live Paystack keys.

## 1. Create an isolated staging target

1. In Supabase, create a separate staging project or a protected database
   branch. Do not select the production project.
2. Record the staging project URL in a password manager; do not commit it with
   any key.
3. In the Supabase SQL Editor, apply
   `database/002_production_booking_schema.sql`, review its successful result,
   then apply `database/003_booking_payments_operations.sql`. Do **not** apply
   `001_initial_schema.sql` to this schema.
4. Run `database/staging_verification.sql`. Every expected table must exist,
   RLS must be enabled, and `anon`/`authenticated` must have `false` for all
   passenger-data privileges.
5. Create a fictional staff account in Supabase Auth. Through a reviewed,
   server-side SQL operation, add its user id to `public.user_roles` with the
   required `admin`, `staff`, or `driver` role. Never grant browser roles direct
   table access.

The migration is deliberately forward-only. It is safe to replay only where
its `IF NOT EXISTS`, `CREATE OR REPLACE`, and enum guards permit it; use a
recorded migration tool and apply it once per database. A failed run must be
investigated before retrying rather than forced against a partially migrated
database.

The connected KelvJessia Supabase project currently has an older auth-only
schema, including a one-role `user_roles` relation. `003` retains existing
`customer` rows and changes its key to `(user_id, role)` so staff and driver
roles can be added. The primary-key replacement deliberately has no `CASCADE`:
if an unknown dependency exists, it fails safely and must be reviewed before a
retry. This does not make the connected project a staging target; use a fresh,
isolated staging database for the rehearsal.

## 2. Configure a protected Vercel Preview deployment

Create a non-production branch such as `staging/booking-upgrade`, connect that
branch to a Vercel Preview deployment, and enable Vercel Deployment Protection
for it. Leave the existing Production environment unchanged.

In the **Preview** environment only, set encrypted values from `.env.example`:

- `SUPABASE_URL` for the isolated staging project
- `SUPABASE_SERVICE_ROLE_KEY`, server-side only
- `BOOKING_RATE_LIMIT_SALT` and a distinct `CRON_SECRET`, both long random
  values
- `KELVJESSIA_BOOKINGS_MODE=staging`
- `KELVJESSIA_STAGING_PROTECTED=true`
- `KELVJESSIA_PAYMENTS_TEST_MODE=true`
- `PAYSTACK_SECRET_KEY` using an `sk_test_` key only
- `PAYSTACK_CALLBACK_URL=https://<protected-preview-domain>/payment.html`
- `TURNSTILE_SECRET_KEY` plus the matching staging site key if Turnstile is
  enabled

Do not use a `pk_live_` or `sk_live_` key. Add the protected Preview URL to
Supabase Auth redirect URLs, configure the Paystack **test-mode** webhook as
`https://<protected-preview-domain>/api/payments/paystack-webhook`, and keep
the Preview URL inaccessible to the public. Configure a protected external
scheduler to call `/api/internal/expire-reservations` every five minutes using
`CRON_SECRET`. Vercel Hobby cannot run this frequency, so the repository does
not declare a Vercel Cron; use a protected staging worker or a Vercel plan
that supports it.

## 3. Staging acceptance tests

Use only test data. Record request ids and results in a private test log, not
in this repository.

| Test | Method | Expected result |
| --- | --- | --- |
| Configuration | Open `/api/config` | Reports staging capability booleans only; no URLs, keys, or secrets. |
| Payment initialization | Create a valid held booking, then initialize payment with a new idempotency key. Retry the same request. | One Paystack test reference and one payment attempt; amount comes from the trip server-side. |
| Server verification | Complete a Paystack test payment and open `payment.html`. | Server calls Paystack verification; only a verified matching amount and NGN payment can confirm the booking. |
| Signed webhook | Deliver the `charge.success` test webhook, then replay it. | HMAC validation succeeds; the replay leaves exactly one payment/booking state change. |
| Invalid webhook | POST a body with a bad signature. | `401`; no booking or payment status changes. |
| Late payment | Let a five-minute test hold expire, then complete the test transaction. | Booking remains expired and payment becomes `recovery_required`; it never consumes a released seat. |
| Reservation expiry | Let a pending hold expire, run the cron route with the secret, and inspect availability. | Booking and active payment expire; seats are released. |
| Concurrent last seat | Send two distinct booking requests simultaneously for the final available seat. | Exactly one pending/confirmed booking succeeds; the other receives an insufficient-seat response. |
| Enquiries | Submit a valid fictional enquiry; use an admin account and a non-staff account. | Admin can list/assign/respond; non-staff is denied; no unauthenticated list access. |
| Driver records | Assign a driver, then use that driver's login to mark pickup/drop-off. Try another driver. | Assigned driver writes server timestamps; another driver is denied; audit record exists. |
| Staff operations | Try admin endpoints as admin, staff, driver, and signed-out user. | Only documented roles are accepted; signed-out users are denied. |

Paystack webhooks are retried by Paystack when an endpoint does not acknowledge
them. A failure must be corrected and retried from the test dashboard; never
manually mark the booking paid as a substitute for server verification.

## 4. Evidence required before any production approval

- Successful output of `database/staging_verification.sql`.
- Test-mode screenshots or request logs for all acceptance tests above.
- Vercel Preview deployment URL showing Deployment Protection enabled.
- Supabase Auth redirect URL and Paystack test webhook configuration reviewed.
- A separate written business approval before any production database,
  production environment variable, live key, or public booking change.
