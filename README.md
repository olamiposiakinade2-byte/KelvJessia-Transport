# KelvJessia Transport

KelvJessia Transport is a static booking-experience demonstration by default. Customers can explore sample schedules and seats, review a request, and open WhatsApp with a prefilled message for KelvJessia Transport.

## Booking safeguards

- Every request is marked **Awaiting Company Confirmation** until the team approves it.
- The customer must tap **Send** in WhatsApp; the website never sends a message automatically.
- Online payments are not collected in the default deployment. A separate,
  protected staging path supports Paystack **test mode** only and remains off
  until its explicit server-side environment gate is configured.
- Customer details entered in the booking form are not stored in browser-local records. The browser-only dashboard contains fictional sample data only.
- The dashboard is clearly marked **DEMO MODE** and is not secure administrator authentication.

## Run locally

```bash
npm run preview
```

## API service

`server/` contains an earlier Node/SQLite proof of concept and is not used by Vercel. The staged Supabase implementation uses the Vercel functions in `api/` together with the reviewed migrations `database/002_production_booking_schema.sql` and `database/003_booking_payments_operations.sql`. It remains disabled unless the server-only environment gates described in [docs/STAGING_DEPLOYMENT.md](docs/STAGING_DEPLOYMENT.md) are explicitly enabled.

## Booking upgrade capabilities (staging only)

- Server-side seat holds with a configurable 5–60 minute duration (15 minutes
  by default), a five-minute expiry job, and database row locks.
- Paystack test-payment initialization, backend verification, HMAC-verified
  idempotent webhook handling, and late-payment recovery/refund flagging.
- A public Enquiries page whose records are private, rate-limited, and managed
  only by authorized staff.
- Pickup locations, drivers, trip operational statuses, and server-timestamped
  pickup/drop-off records. This is not GPS tracking.
- Protected REST APIs for bookings, payments, enquiries, staff operations, and
  driver-assigned trips. Payment keys and database service credentials are
  never sent to the browser.

See [BOOKING_UPGRADE_PLAN.md](BOOKING_UPGRADE_PLAN.md) for the audit and phased
delivery plan, [.env.example](.env.example) for required server-only variables,
and [docs/STAGING_DEPLOYMENT.md](docs/STAGING_DEPLOYMENT.md) for the staging
procedure.

## Vercel deployment

This project is configured as a static deployment with `dist/` as the output directory.

1. Import the GitHub repository into Vercel.
2. Keep the framework preset as **Other**.
3. Leave the build command empty.
4. Confirm the output directory is `dist` (also declared in `vercel.json`).
5. Deploy, then verify the booking flow and `/#admin` dashboard on the generated URL.

The PDF report feature loads jsPDF from jsDelivr in the browser. It needs an internet connection at the moment the report is generated.
