# OlaDB incremental migration plan

## Guardrails

- Do not alter the public Vercel deployment or enable public reservations.
- Do not apply a migration to the current Supabase database or any production
  database.
- Use Paystack test keys only; all Paystack calls stay server-side.
- Do not import passenger data until an explicit, reviewed migration window is
  approved. Initial OlaDB fixtures remain fictional.

## Phase A — Foundation and local verification

1. Repair the local OlaDB dependency installation, create a private local
   PostgreSQL database, and set `DATABASE_URL` in an uncommitted `.env` file.
2. Run Prisma generation and an OlaDB-only initial migration.
3. Add health, connection-failure, backup verification, and structured error
   logging tests.
4. Preserve the existing KelvJessia static-site test suite unchanged.

**Exit criteria:** OlaDB build, unit tests, and migration tests pass against a
local PostgreSQL database.

## Phase B — Portable transport data model

1. Extend Prisma with users, roles, sessions, login attempts, vehicles, trips,
   booking holds, booking history, payment attempts, webhook events, enquiries,
   enquiry responses, drivers, pickup/drop-off records, audit logs, and job
   execution records.
2. Add PostgreSQL constraints and indexes for references, event hashes,
   idempotency keys, one active payment attempt, and active booking queries.
3. Implement a transactional booking repository using `SELECT ... FOR UPDATE`
   on the trip row. It expires stale holds before calculating capacity.
4. Implement a transactional payment repository that cannot confirm a late,
   mismatched, or replayed payment.

**Exit criteria:** concurrent-final-seat, idempotency, hold-expiry, webhook
replay, and late-payment integration tests pass against local PostgreSQL.

## Phase C — Identity and protected REST API

1. Replace the environment-only administrator with locally stored, bcrypt-hashed
   administrator, staff, and driver accounts.
2. Replace JWT-only sessions with opaque, hashed, revocable database sessions
   in secure HTTP-only cookies. Add CSRF protection for cookie-authenticated
   state-changing requests and durable login rate limiting.
3. Create fixed REST routes for the approved operations; do not add arbitrary
   SQL, connection-string display, or public table browsing.
4. Authorize every server operation using the current session and role; record
   security-sensitive actions in the audit log.

**Exit criteria:** authentication, role matrix, CSRF, rate-limit and
unauthorized-access tests pass.

## Phase D — Workers, payment and operations

1. Add a private scheduler/worker process that claims due jobs with database
   locks and records success/failure. Reservation expiry must not depend on a
   browser or Vercel Cron.
2. Move Paystack initialize, verification and webhook handlers into OlaDB.
   Verify webhooks with HMAC SHA-512, verify transactions with Paystack, and
   deduplicate by both provider reference and event hash.
3. Add enquiries, driver-assignment, server-timestamped pickup/drop-off, and
   staff workflows to the OlaDB API.

**Exit criteria:** worker retry, database outage, payment and driver operation
tests pass with test fixtures.

## Phase E — Staging cutover rehearsal

1. Provision a separate staging PostgreSQL database and least-privilege
   application database role. Configure automated encrypted backups and a
   restore drill.
2. Deploy OlaDB to a protected staging environment; configure only staging
   environment variables and a test-mode Paystack webhook.
3. Run the complete test matrix from `docs/STAGING_VALIDATION.md`, adapted to
   the OlaDB endpoints, using fictional records.
4. Only after a written approval and a reviewed export/import plan may a
   one-time Supabase-to-OlaDB data migration be rehearsed. Keep source data
   read-only throughout the rehearsal.

**Exit criteria:** staging acceptance tests, backup restore, monitoring and
cross-device tests pass. Production remains unchanged.

## Current blockers

- OlaDB dependencies are incomplete locally: `tsx` and `prisma` executables
  are absent and `npm install` ended with `ECONNRESET`.
- No local PostgreSQL server or `DATABASE_URL` is configured.
- No separate OlaDB staging database, protected deployment target, Paystack
  test configuration, or backup destination has been authorized.

Resolve these before implementing or claiming validated database integration.
