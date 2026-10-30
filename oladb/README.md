# OlaDB — Phase 1

OlaDB is a private, single-administrator database dashboard for personal web
projects. It is intentionally separate from KelvJessia Transport and ships
only fictional demonstration records. It does not create public registrations,
process payments, connect to a public transport website, or expose any database
credentials in browser code.

## Features

- Next.js + TypeScript + Tailwind CSS dashboard.
- PostgreSQL data model managed through Prisma.
- One administrator authenticated against an environment-provided bcrypt hash.
- Signed, secure HTTP-only session cookie with an eight-hour expiry.
- Server-side, authenticated REST APIs for projects, table records, and health.
- Controlled CRUD for the approved vehicle, trip, booking, and history models;
  no arbitrary SQL endpoint exists.
- Database health probe via Prisma's parameterized raw-query API.
- Project-scoped fictional KelvJessia Transport seed data.

## Local setup

1. Install and start PostgreSQL locally, then create a database named `oladb`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your local database.
3. Generate an administrator password hash without committing either the hash
   or password:

   ```powershell
   npm install
   npm run password:hash -- "use-a-long-unique-password"
   ```

   Put the returned hash in `OLADB_ADMIN_PASSWORD_HASH`, set
   `OLADB_ADMIN_EMAIL`, and set a unique `SESSION_SECRET` of at least 32
   characters.
4. Create the schema and generate Prisma client code:

   ```powershell
   npm run db:generate
   npm run db:migrate -- --name initial_phase_1
   ```
5. Seed fictional data only:

   ```powershell
   $env:OLADB_ALLOW_DEMO_SEED="true"
   npm run db:seed
   ```
6. Start the local application:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000` and sign in with the configured administrator
   account.

## Security model and limitations

- PostgreSQL connection strings and the password hash are server-side
  environment variables. Do not prefix them with `NEXT_PUBLIC_`.
- Passwords are verified with bcrypt; they are never stored in Prisma models.
- Every data API checks the signed session on the server. There is no public
  registration or unauthenticated health endpoint.
- CRUD is limited to a fixed allow-list of Prisma models and validated fields.
  A user cannot submit SQL through the dashboard.
- This is Phase 1: it is local-only and expects a single trusted administrator.
  Add CSRF protection, login throttling, backup/restore, MFA, audit actor IDs,
  and deployment secrets management before placing it on a network.

## Development roadmap

1. Add local PostgreSQL container instructions or a managed private database.
2. Add MFA, password rotation, login rate limiting, and a durable audit actor.
3. Add encrypted per-project connection configuration and least-privilege DB
   credentials.
4. Add read-only database introspection for approved project connections.
5. Evaluate a secure, explicitly approved KelvJessia integration; do not connect
   production customer data without a separate review.
