# KelvJessia Transport — concept demonstration

This is an interactive client demonstration, not an official booking system. It uses browser-local sample data so it creates no real reservations, payments, notifications, or WhatsApp messages.

## Run locally

Open `dist/index.html` in a browser, or run `npx serve dist` and visit the URL it prints.

The Booking desk simulates a reservation, enforces sample seat limits in the browser, and issues a local reference. The Admin demo accepts `demo@kelvjessia.example` with `demo2026` and can filter, update, export, and reset **fictional** bookings.

## Production handoff

The supplied SQL migration defines Supabase tables, indexes, RLS policy direction, audit logging, and a locking reservation RPC. Before launch: confirm the WhatsApp Business number, provide actual fleet/specification imagery, configure Supabase Auth, run the migration, move booking validation and capacity checks into server route handlers, add rate limiting/idempotency, and connect Paystack with server-side webhooks. Never place service-role or Paystack keys in the browser.

## Deployment

The `dist/` folder is a static demo and can be deployed to a static host. For the requested production stack, move this design into a Next.js App Router project and deploy it to Vercel after Supabase and environment variables are configured. Keep the published concept private until business review is complete.
