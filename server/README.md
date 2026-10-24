# Self-hosted API

This Node 22+ API uses the built-in SQLite driver. It is intentionally separate from the static demo host: run it on a VPS, container, or a Node-compatible service with a persistent disk/volume. Vercel and the current static Site deployment cannot persist its SQLite file.

Run `npm run api`. Set `KELVJESSIA_DB_PATH` to a persistent absolute file path in production. API endpoints: `GET /api/health`, `GET /api/trips`, `POST /api/bookings` (requires an `Idempotency-Key` header), and `GET /api/bookings/:reference`.

Seat allocation uses `BEGIN IMMEDIATE`, a transaction, and a database constraint, so competing requests cannot take the same final seat in a single deployed SQLite instance. For multi-instance production, migrate the same transaction to PostgreSQL before horizontal scaling.
