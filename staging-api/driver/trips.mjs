import { bookingIntakeEnabled, json, readJson, requestError, requireRole, safeText, supabaseRequest } from '../_lib.mjs';

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f-]{34}$/i.test(value);

export default async function handler(req, res) {
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The driver area is not enabled.' });
  try {
    const user = await requireRole(req, ['driver']);
    const profiles = await supabaseRequest(`/rest/v1/drivers?select=id&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`);
    const driver = Array.isArray(profiles) ? profiles[0] : null;
    if (!driver) return json(res, 403, { error: 'No active driver profile is assigned to this account.' });
    if (req.method === 'GET') {
      const trips = await supabaseRequest(`/rest/v1/trips?driver_id=eq.${encodeURIComponent(driver.id)}&select=id,origin,destination,departure_at,pickup_time,estimated_arrival_at,estimated_duration_minutes,operational_status,vehicles(name),bookings(id,reference,passenger_name,passenger_phone,seat_count,status,pickup_records(actual_pickup_at),dropoff_records(actual_dropoff_at))&order=departure_at.asc&limit=100`);
      return json(res, 200, { trips });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET, PATCH' });
    const body = await readJson(req); const bookingId = safeText(body.bookingId, 36); const action = safeText(body.action, 12); const correctionReason = safeText(body.correctionReason, 1000);
    if (!isUuid(bookingId) || !['pickup', 'dropoff'].includes(action)) return json(res, 400, { error: 'Invalid passenger event.' });
    const allowed = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,trips!inner(driver_id)&trips.driver_id=eq.${encodeURIComponent(driver.id)}&limit=1`);
    if (!Array.isArray(allowed) || !allowed.length) return json(res, 404, { error: 'This passenger is not assigned to your trip.' });
    await supabaseRequest('/rest/v1/rpc/record_passenger_event', { method: 'POST', body: { p_booking_id: bookingId, p_event: action, p_actor_id: user.id, p_correction_reason: correctionReason || null } });
    json(res, 200, { recorded: action, serverRecordedAt: new Date().toISOString() });
  } catch (error) { requestError(res, error); }
}
