import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingInput, projectInput, tripInput, vehicleInput } from '../lib/validation';

test('accepts a controlled project input', () => assert.equal(projectInput.parse({ name: 'KelvJessia Transport', slug: 'kelvjessia-transport' }).slug, 'kelvjessia-transport'));
test('rejects unsafe project slugs', () => assert.throws(() => projectInput.parse({ name: 'Bad', slug: 'bad project; drop table' })));
test('rejects invalid passenger phone values', () => assert.throws(() => bookingInput.parse({ tripId: 'ck1234567890123456789012345', reference: 'DEMO-TEST-001', passengerName: 'Demo User', passengerPhone: '<script>', seatCount: 1 })));
test('rejects a trip with identical endpoints', () => assert.throws(() => tripInput.parse({ vehicleId: 'ck1234567890123456789012345', origin: 'Lagos', destination: 'Lagos', departureAt: '2030-01-10T08:00:00.000Z', seatCapacity: 18 })));
test('bounds vehicle capacity', () => assert.throws(() => vehicleInput.parse({ name: 'Demo', capacity: 999 })));
