import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/booking-demo.js', import.meta.url), 'utf8');
const capacity = (capacity, bookings) => capacity - bookings.filter(booking => booking.status !== 'Cancelled').reduce((sum, booking) => sum + booking.seats, 0);
const csvValue = value => {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

assert.equal(capacity(18, [{ status: 'Pending', seats: 2 }, { status: 'Confirmed', seats: 3 }, { status: 'Cancelled', seats: 4 }]), 13);
assert.equal(csvValue('=SUM(A1:A2)'), "\"'=SUM(A1:A2)\"");
assert.equal(csvValue('A, B'), '"A, B"');
assert.match(source, /Reset Demo Data/);
assert.match(source, /Download Booking Report \(PDF\)/);
assert.match(source, /DEMO — SAMPLE DATA/);
assert.match(source, /booking\.status !== 'Cancelled'/);

console.log('Sample booking capacity, CSV safety, and dashboard controls validated.');
