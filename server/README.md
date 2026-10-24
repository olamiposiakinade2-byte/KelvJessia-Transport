# Self-hosted API

This Node 22+ API uses the built-in SQLite driver. It is intentionally separate from the static demo host: run it on a VPS, container, or a Node-compatible service with a persistent disk/volume. Vercel and the current static Site deployment cannot persist its SQLite file.

Run `npm run api`. Set `KELVJESSIA_DB_PATH` to a persistent absolute file path in production. API endpoints: `GET /api/health`, `GET /api/trips`, `POST /api/bookings` (requires an `Idempotency-Key` header), and `GET /api/bookings/:reference`.

## Railway deployment

1. Create a Railway project and deploy this GitHub repository.
2. Set the service start command to `npm run api` (also declared in `railway.json`).
3. Attach a Railway Volume and mount it at `/data`.
4. Add `KELVJESSIA_DB_PATH=/data/kelvjessia.db` in the service variables.
5. Generate a public domain, then set `Access-Control-Allow-Origin` to the final KelvJessia Site domain before connecting the browser UI.

Do not use Railway ephemeral storage for the database: redeploying would erase bookings.

Seat allocation uses `BEGIN IMMEDIATE`, a transaction, and a database constraint, so competing requests cannot take the same final seat in a single deployed SQLite instance. For multi-instance production, migrate the same transaction to PostgreSQL before horizontal scaling.
