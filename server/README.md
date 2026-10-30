# Self-hosted API

This Node 22+ API uses the built-in SQLite driver. It is intentionally separate from the static demo host: run it on a VPS, container, or a Node-compatible service with a persistent disk/volume. Vercel and the current static Site deployment cannot persist its SQLite file.

Run `npm run api`. Set `KELVJESSIA_DB_PATH` to a persistent absolute file path in production. API endpoints: `GET /api/health`, `GET /api/trips`, `POST /api/bookings` (requires an `Idempotency-Key` header), and `GET /api/bookings/:reference?phone=...` (requires the booking phone number).

## Render deployment

`render.yaml` declares a paid Render web service with a persistent disk. In Render, create a **Blueprint** from this GitHub repository and approve the service plan. The database file is configured at `/var/data/kelvjessia.db` and only the site domain is permitted by CORS.

After the first successful deploy, copy the Render service URL and verify `/api/health`. The public static Site will still use its safe local demo fallback until its client configuration is updated with that URL.

## Paystack test checkout

This backend supports Paystack **test mode only**. Set these encrypted Render
environment values; do not place them in the website or repository:

- `PAYSTACK_SECRET_KEY` — a Paystack key beginning with `sk_test_`
- `PAYSTACK_CALLBACK_URL` — the protected payment-return URL
- `KELVJESSIA_ADMIN_TOKEN` — a separate random secret, at least 32 characters
- `KELVJESSIA_PAYMENTS_TEST_MODE=true`

The server rejects live Paystack keys. A staff request must first confirm the
booking, then create a checkout link. The link is initialized on the server;
Paystack is verified on the server after the customer returns and again when a
signed webhook arrives. The webhook is replay-safe and the private payment
endpoint reports `PENDING`, `PAID`, or `RECOVERY_REQUIRED`.

Use these private, staff-only API requests with an `Authorization: Bearer`
header containing `KELVJESSIA_ADMIN_TOKEN`:

```text
POST /api/admin/bookings/{reference}/confirm
POST /api/admin/bookings/{reference}/payment-link
GET  /api/admin/payments
```

Set the Paystack test webhook to
`https://<render-service>/api/payments/paystack-webhook`. Do not enable a live
key or send a real checkout link until the staff dashboard authentication and
staging tests are complete.

Do not use ephemeral storage for the database: redeploying would erase bookings. A disk permits one service instance only, which is appropriate for this SQLite deployment.

Seat allocation uses `BEGIN IMMEDIATE`, a transaction, and a database constraint, so competing requests cannot take the same final seat in a single deployed SQLite instance. For multi-instance production, migrate the same transaction to PostgreSQL before horizontal scaling.
