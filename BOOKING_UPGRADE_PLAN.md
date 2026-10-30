# KelvJessia Transport booking upgrade plan

Audited: 28 October 2026 (Africa/Lagos)

## Current architecture

- `dist/` is the deployed static HTML/CSS/browser-JavaScript website.
- `booking-demo.js` supplies the default, clearly labelled fictional-data and
  WhatsApp-request experience. It does not persist customer data.
- `api/` contains Vercel serverless functions. They are disabled unless an
  explicit staging or approved-live environment gate is enabled.
- `database/002_production_booking_schema.sql` is the intended protected
  PostgreSQL/Supabase booking baseline. It already has row-locking for seats,
  server-side expiry, rate-limit fingerprints, RLS, and booking audit history.
- `server/` is an older SQLite proof of concept and is not part of Vercel's
  deployed path.

## Audit findings

1. There is no payment provider, payment record, webhook verification, or
   booking receipt implementation.
2. Pending booking holds already expire in the database function, but there is
   no customer countdown, configurable duration, payment-safe reconciliation,
   or scheduled expiry safety net.
3. Enquiries currently hand off to WhatsApp only; there is no secure enquiry
   record, administration, assignment, or response model.
4. The public planner displays estimated arrival copy only. It has no managed
   pickup locations, trip/driver assignment, actual pickup/drop-off records,
   or driver permissions.
5. The demo dashboard is intentionally browser-only. The protected production
   dashboard currently handles bookings only.
6. `001_initial_schema.sql` is an earlier, incompatible prototype. Do not run
   it together with `002_production_booking_schema.sql`. The upgrade uses a
   forward-only `003` migration from the `002` baseline.
7. The connected Supabase project currently has only the earlier auth schema
   (`profiles` and a single-role `user_roles` table). It is not a ready
   booking-database baseline. `003` now expands that relation safely to retain
   `customer` while permitting the audited `admin`, `staff`, and `driver`
   roles, but the full booking migration must still be rehearsed only in a
   separate staging database.

## Delivery phases

1. **Data and access foundation** — extend the protected schema for payments,
   enquiries, locations, drivers, trip operations and audits; add role helpers
   and server-only APIs.
2. **Reservation and payment safety** — add payment initiation, Paystack
   server verification, HMAC-verified idempotent webhooks, receipt data and
   expiry/recovery handling. The API stays off until staging variables and
   test-mode credentials are configured.
3. **Customer experience** — retain the existing demo by default, add the
   Enquiries page and staged payment/countdown journey when the protected API
   is available.
4. **Staff operations** — extend protected administration for payments,
   enquiries and trip operations; add a driver-only operations API.
5. **Verification and deployment** — run static/API tests, apply only to a
   protected staging database, use Paystack test mode, and obtain written
   approval before any live booking or payment gate is enabled.

## Explicit non-goals until approval

- No production deployment or public real-booking activation.
- No live payment collection, real customer migration, or card-data handling.
- No claimed live GPS tracking.
