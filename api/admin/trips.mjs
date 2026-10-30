import { bookingIntakeEnabled, json, readJson, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f-]{34}$/i.test(value);
const operational = new Set(['scheduled', 'boarding', 'departed', 'in_transit', 'completed', 'cancelled']);
const positiveInteger = value => Number.isInteger(value) && value > 0;

export default async function handler(req, res) {
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The protected administration area is not enabled.' });
  try {
    const admin = await requireAdmin(req);
    if (req.method === 'GET') {
      const trips = await supabaseRequest('/rest/v1/trips?select=id,origin,destination,departure_at,seat_capacity,fare_kobo,pickup_time,estimated_duration_minutes,estimated_arrival_at,operational_status,is_published,vehicles(name),drivers(full_name),pickup_locations(name)&order=departure_at.asc&limit=250');
      return json(res, 200, { trips });
    }
    const body = await readJson(req);
    if (req.method === 'POST') {
      const vehicleId = safeText(body.vehicleId, 36); const origin = safeText(body.origin, 160); const destination = safeText(body.destination, 160); const departureAt = safeText(body.departureAt, 40); const capacity = Number(body.seatCapacity); const fareKobo = Number(body.fareKobo);
      if (!isUuid(vehicleId) || origin.length < 2 || destination.length < 2 || origin === destination || !Number.isFinite(Date.parse(departureAt)) || !positiveInteger(capacity) || !Number.isInteger(fareKobo) || fareKobo < 0) return json(res, 400, { error: 'Invalid trip details.' });
      const rows = await supabaseRequest('/rest/v1/trips', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { vehicle_id: vehicleId, origin, destination, departure_at: new Date(departureAt).toISOString(), seat_capacity: capacity, fare_kobo: fareKobo, is_published: false, operational_status: 'scheduled' } });
      await supabaseRequest('/rest/v1/audit_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { actor_id: admin.id, action: 'trip_created', entity_type: 'trip', entity_id: rows?.[0]?.id, after_state: { origin, destination } } });
      return json(res, 201, { trip: rows?.[0] || null });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET, POST, PATCH' });
    const id = safeText(body.id, 36); const status = safeText(body.operationalStatus, 20); const hasDriver = Object.hasOwn(body, 'driverId'); const driverId = !hasDriver ? undefined : (body.driverId === null ? null : safeText(body.driverId, 36));
    if (!isUuid(id) || !operational.has(status) || (driverId && !isUuid(driverId))) return json(res, 400, { error: 'Invalid trip update.' });
    const rows = await supabaseRequest(`/rest/v1/trips?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { operational_status: status, ...(hasDriver ? { driver_id: driverId } : {}) } });
    if (!Array.isArray(rows) || !rows.length) return json(res, 404, { error: 'Trip was not found.' });
    await supabaseRequest('/rest/v1/audit_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { actor_id: admin.id, action: 'trip_updated', entity_type: 'trip', entity_id: id, after_state: { operationalStatus: status, driverId } } });
    json(res, 200, { trip: rows[0] });
  } catch (error) { requestError(res, error); }
}
