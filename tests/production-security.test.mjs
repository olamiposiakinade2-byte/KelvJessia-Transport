import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../database/002_production_booking_schema.sql', import.meta.url), 'utf8');
const bookingApi = readFileSync(new URL('../staging-api/bookings.mjs', import.meta.url), 'utf8');
const apiLibrary = readFileSync(new URL('../staging-api/_lib.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../dist/booking-demo.js', import.meta.url), 'utf8');

assert.match(schema, /for update;/i);
assert.match(schema, /pg_advisory_xact_lock/);
assert.match(schema, /interval '15 minutes'/);
assert.match(schema, /alter table public\.bookings enable row level security/i);
assert.match(schema, /revoke all on table public\.vehicles, public\.trips, public\.bookings, public\.booking_status_history from anon, authenticated/i);
assert.match(schema, /grant execute on function public\.create_server_booking[\s\S]+to service_role/i);
assert.match(schema, /booking_status_history/);
assert.match(bookingApi, /bookingIntakeEnabled\(\)/);
assert.match(bookingApi, /verifyTurnstile/);
assert.match(apiLibrary, /KELVJESSIA_REAL_BOOKING_APPROVED === 'true'/);
assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(client, /Confirm Booking via WhatsApp/);

console.log('Production booking safety gates, server-side locking, RLS, and secret isolation validated.');
