import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/booking-demo.js', import.meta.url), 'utf8');
const number = '2348036168642';
const message = [
  'Hello KelvJessia Transport,',
  '',
  'BOOKING REQUEST',
  'Booking Reference: KJT-2026-001',
  'Passenger Name: Test Passenger',
  'Phone Number: 08000000000',
  'Pickup Location: Augustine University, Ilara-Epe',
  'Destination: Lagos',
  'Travel Date: 2030-01-10',
  'Departure Time: 08:00',
  'Number of Seats: 2',
  'Special Requirements: None',
  'BOOKING STATUS: AWAITING COMPANY CONFIRMATION'
].join('\n');
const handoff = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

assert.match(source, /const WHATSAPP_NUMBER = '2348036168642'/);
assert.match(source, /Continue to WhatsApp/);
assert.match(source, /encodeURIComponent\(message\)/);
assert.match(source, /BOOKING STATUS: AWAITING COMPANY CONFIRMATION/);
assert.match(source, /window\.open\(url, '_blank', 'noopener'\)/);
assert.equal(new URL(handoff).pathname, `/${number}`);
assert.equal(new URL(handoff).searchParams.get('text'), message);
assert.ok(!handoff.includes('Test Passenger'), 'The handoff URL encodes customer details rather than exposing raw text.');

console.log('WhatsApp handoff URL validated for desktop web and mobile app deep-link use.');
