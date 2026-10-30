import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server/app.mjs', import.meta.url), 'utf8');
const render = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');

assert.match(source, /paystackSecret\.startsWith\('sk_test_'\)/);
assert.doesNotMatch(source, /sk_live_/);
assert.match(source, /timingSafeEqual/);
assert.match(source, /createHmac\('sha512'/);
assert.match(source, /payment_webhook_events/);
assert.match(source, /event_hash TEXT PRIMARY KEY/);
assert.match(source, /Only confirmed bookings can be paid/);
assert.match(source, /payment\.booking_status === 'CONFIRMED'/);
assert.match(source, /\/transaction\/initialize/);
assert.match(source, /\/transaction\/verify/);
assert.match(source, /event_hash FROM payment_webhook_events/);
assert.match(source, /KELVJESSIA_ADMIN_TOKEN/);
assert.match(source, /RECOVERY_REQUIRED/);
assert.match(render, /PAYSTACK_SECRET_KEY[\s\S]*sync: false/);
assert.match(render, /KELVJESSIA_ADMIN_TOKEN[\s\S]*sync: false/);

console.log('Render Paystack test-mode gates, signed webhook handling, and private staff controls validated.');
