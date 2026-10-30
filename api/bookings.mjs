import crypto from 'node:crypto';
import { bookingIntakeEnabled, json, permitMemoryAttempt, readJson, requestError, requestFingerprint, safeText, supabaseRequest, verifyTurnstile } from './_lib.mjs';

function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'Real booking requests are not enabled.' });
  if (!permitMemoryAttempt(req)) return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  try {
    const body = await readJson(req);
    const tripId = body.tripId;
    const passengerName = safeText(body.passengerName, 120);
    const passengerEmail = safeText(body.passengerEmail, 254);
    const passengerPhone = safeText(body.passengerPhone, 30);
    const specialRequirements = safeText(body.specialRequirements, 1000);
    const seatCount = Number(body.seatCount);
    if (!validUuid(tripId) || passengerName.length < 2 || !/^[0-9+() -]{7,30}$/.test(passengerPhone) || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > 20) {
      return json(res, 400, { error: 'Please check the booking details and try again.' });
    }
    if (passengerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passengerEmail)) return json(res, 400, { error: 'Please enter a valid email address.' });
    await verifyTurnstile(body.turnstileToken, req);
    const idempotencyKey = validUuid(body.idempotencyKey) ? body.idempotencyKey : crypto.randomUUID();
    const rows = await supabaseRequest('/rest/v1/rpc/create_server_booking', {
      method: 'POST',
      body: {
        p_trip_id: tripId, p_passenger_name: passengerName, p_passenger_email: passengerEmail || null,
        p_passenger_phone: passengerPhone, p_seat_count: seatCount,
        p_special_requirements: specialRequirements || null, p_idempotency_key: idempotencyKey,
        p_request_fingerprint: requestFingerprint(req)
      }
    });
    const booking = Array.isArray(rows) ? rows[0] : null;
    if (!booking) throw new Error('Booking could not be created');
    json(res, 201, { booking: { reference: booking.reference, status: booking.status, holdExpiresAt: booking.hold_expires_at } });
  } catch (error) { requestError(res, error); }
}
