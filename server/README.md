# Self-hosted API

This Node 22+ API uses the built-in SQLite driver. It is intentionally separate from the static demo host: run it on a VPS, container, or a Node-compatible service with a persistent disk/volume. Vercel and the current static Site deployment cannot persist its SQLite file.

Run `npm run api`. Set `KELVJESSIA_DB_PATH` to a persistent absolute file path in production. API endpoints: `GET /api/health`, `GET /api/trips`, `POST /api/bookings` (requires an `Idempotency-Key` header), and `GET /api/bookings/:reference?phone=...` (requires the booking phone number).

## Render deployment

`render.yaml` declares a paid Render web service with a persistent disk. In Render, create a **Blueprint** from this GitHub repository and approve the service plan. The database file is configured at `/var/data/kelvjessia.db` and only the site domain is permitted by CORS.

After the first successful deploy, copy the Render service URL and verify `/api/health`. The public static Site will still use its safe local demo fallback until its client configuration is updated with that URL.

Do not use ephemeral storage for the database: redeploying would erase bookings. A disk permits one service instance only, which is appropriate for this SQLite deployment.

Seat allocation uses `BEGIN IMMEDIATE`, a transaction, and a database constraint, so competing requests cannot take the same final seat in a single deployed SQLite instance. For multi-instance production, migrate the same transaction to PostgreSQL before horizontal scaling.
