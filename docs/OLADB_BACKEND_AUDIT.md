# OlaDB backend migration audit

Audited: 28 October 2026 (Africa/Lagos)

## Scope and current safety state

The public KelvJessia Transport website remains a static Vercel deployment in
demo mode by default. The database-backed APIs are serverless functions under
`staging-api/`, and are gated behind staging/approval environment variables. This
audit makes no change to the public site, Supabase project, or payment mode.

## Supabase dependencies to replace

| Current dependency | Current use | OlaDB replacement |
| --- | --- | --- |
| Supabase REST API | `staging-api/_lib.mjs` sends server-side `/rest/v1` and `/rpc` calls. | TypeScript repository services using Prisma and parameterized PostgreSQL transactions. |
| Supabase Auth | Admin login calls `/auth/v1/token`; staff identity calls `/auth/v1/user`; logout calls `/auth/v1/logout`. | Local credential records, bcrypt password verification, opaque server-side sessions, HTTP-only cookies, revocation and login throttling. |
| Supabase service-role key | Server-only database authority and role lookup. | A least-privilege `oladb_app` PostgreSQL user available only to the OlaDB server process. |
| Supabase RLS/Data API grants | Protects public-schema tables from `anon` and `authenticated`. | No direct database/Data API exposure. PostgreSQL is reachable only from OlaDB; authorization is enforced in server routes and transactions. |
| Supabase RPC functions | Seat allocation, payment state changes, expiry, enquiry intake and passenger events. | Repository methods backed by SQL transactions, row locks, unique constraints, and database indexes. |
| Supabase Auth user IDs | Foreign keys for roles, drivers, audit and assignment. | `oladb_users` UUID identities, with a one-time source-id mapping during an approved data import. |

## Existing migrations and database behavior

- `database/001_initial_schema.sql` is an obsolete incompatible prototype and
  must not be combined with the newer baseline.
- `database/002_production_booking_schema.sql` defines vehicles, trips,
  bookings, booking history, durable request fingerprints, booking seat locks,
  hold expiry, RLS, and Supabase-only function privileges.
- `database/003_booking_payments_operations.sql` adds payments, webhook replay
  records, enquiries, drivers, pickup locations, pickup/drop-off records,
  settings and audit logs. It also provides the payment, expiry, enquiry, and
  driver RPC functions.
- `database/staging_verification.sql` is a Supabase/PostgreSQL metadata check;
  it is not the OlaDB migration.

The functional schema is broadly portable PostgreSQL. The Supabase-specific
parts are `auth.users` foreign keys, `anon`/`authenticated`/`service_role`
grants, RLS policies, the Data API contract, and RPC invocation over HTTP.

## Authentication and authorization audit

- Admin login currently exchanges email/password with Supabase Auth and stores
  the returned access token in a secure HTTP-only cookie.
- `requireRole` validates that token through Supabase Auth and queries
  `user_roles` server-side.
- Admin routes require `admin`; the driver route requires `driver`, verifies an
  active driver profile, then checks the booking belongs to the assigned trip.
- The current `user_roles` migration allows `customer`, `admin`, `staff`, and
  `driver`. The connected legacy database previously had only one role per
  user, so source identity migration must be explicit and reviewed.

## API and job audit

| Area | Current API/function | Required OlaDB service |
| --- | --- | --- |
| Trips | `staging-api/trips.mjs` / `list_server_trips` | published-trip availability query with locked active holds excluded from availability. |
| Booking | `staging-api/bookings.mjs` / `create_server_booking` | transaction: idempotency lookup, fingerprint rate limit, `FOR UPDATE` trip lock, expiry sweep, capacity check, pending hold insert. |
| Payments | initialize, verify, webhook / `create_payment_attempt`, `record_verified_payment` | Paystack server client plus transactional payment service and unique event hash. |
| Expiry | `staging-api/internal/expire-reservations.mjs` / `expire_unpaid_reservations` | authenticated scheduler worker calling a single idempotent expiry transaction. |
| Enquiries | `staging-api/enquiries.mjs`, `staging-api/admin/enquiries.mjs` | rate-limited public submission and role-protected staff workflow. |
| Operations | admin trips, vehicles, drivers, locations, settings | validated, role-protected OlaDB REST routes with audit records. |
| Driver events | `staging-api/driver/trips.mjs` / `record_passenger_event` | assigned-driver authorization and server-generated pickup/drop-off timestamps. |

## Environment-variable audit

Retire after OlaDB cutover: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Retain server-side only: `PAYSTACK_SECRET_KEY` (test key only),
`PAYSTACK_CALLBACK_URL`, `BOOKING_RATE_LIMIT_SALT`, `TURNSTILE_SECRET_KEY`,
`CRON_SECRET`, staging and approval gates.

Add for OlaDB: `DATABASE_URL`, a separate `DATABASE_URL_STAGING`,
`SESSION_SECRET`, `OLADB_SESSION_COOKIE_NAME`, login-rate-limit configuration,
`OLADB_APP_ENCRYPTION_KEY` for future encrypted project credentials, and a
structured error-log destination. None may use a browser-exposed prefix.

## Audit conclusion

OlaDB already exists as a separate local Next.js/TypeScript/Prisma foundation.
It currently supports only a single administrator and the basic project,
vehicle, trip, booking, and history models. It does **not** yet implement the
transport payment, expiry, enquiry, driver, multi-role, scheduler, backup,
logging, or cross-device features. The public KelvJessia API must continue to
use its current disabled/demo path until OlaDB reaches staging integration
coverage.
