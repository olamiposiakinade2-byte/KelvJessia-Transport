import { bookingIntakeEnabled, json, readJson, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

const isUuid = value => /^[0-9a-f]{8}-[0-9a-f-]{34}$/i.test(value);
const resources = new Set(['vehicles', 'drivers', 'pickup_locations', 'booking_settings', 'pickup_records', 'dropoff_records']);

function resourceQuery(resource) {
  if (resource === 'vehicles') return '/rest/v1/vehicles?select=id,name,registration_reference,capacity,is_active,created_at&order=created_at.desc&limit=250';
  if (resource === 'drivers') return '/rest/v1/drivers?select=id,user_id,full_name,phone,licence_reference,is_active,created_at&order=created_at.desc&limit=250';
  if (resource === 'pickup_locations') return '/rest/v1/pickup_locations?select=id,name,address,instructions,is_active,created_at&order=name.asc&limit=250';
  if (resource === 'booking_settings') return '/rest/v1/booking_settings?select=hold_minutes,updated_at&singleton=eq.true&limit=1';
  if (resource === 'pickup_records') return '/rest/v1/pickup_records?select=id,actual_pickup_at,correction_reason,bookings!inner(reference,passenger_name,passenger_phone)&order=actual_pickup_at.desc&limit=250';
  return '/rest/v1/dropoff_records?select=id,actual_dropoff_at,correction_reason,bookings!inner(reference,passenger_name,passenger_phone)&order=actual_dropoff_at.desc&limit=250';
}

export default async function handler(req, res) {
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The protected administration area is not enabled.' });
  try {
    const admin = await requireAdmin(req);
    const url = new URL(req.url, 'https://placeholder.invalid'); const resource = safeText(url.searchParams.get('resource'), 32);
    if (!resources.has(resource)) return json(res, 400, { error: 'Unknown operations resource.' });
    if (req.method === 'GET') return json(res, 200, { records: await supabaseRequest(resourceQuery(resource)) });
    if (req.method !== 'POST' && req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET, POST, PATCH' });
    const body = await readJson(req); let endpoint; let data; let entityId;
    if (resource === 'booking_settings') {
      const holdMinutes = Number(body.holdMinutes);
      if (!Number.isInteger(holdMinutes) || holdMinutes < 5 || holdMinutes > 60) return json(res, 400, { error: 'Hold duration must be between 5 and 60 minutes.' });
      endpoint = '/rest/v1/booking_settings?singleton=eq.true'; data = { hold_minutes: holdMinutes, updated_at: new Date().toISOString(), updated_by: admin.id }; entityId = null;
    } else {
      const id = safeText(body.id, 36);
      if (req.method === 'PATCH' && !isUuid(id)) return json(res, 400, { error: 'A valid record ID is required.' });
      if (resource === 'vehicles') {
        const name = safeText(body.name, 120); const registration = safeText(body.registrationReference, 120); const capacity = Number(body.capacity); const active = body.isActive !== false;
        if (name.length < 2 || !Number.isInteger(capacity) || capacity < 1 || capacity > 200) return json(res, 400, { error: 'Invalid vehicle details.' });
        endpoint = req.method === 'POST' ? '/rest/v1/vehicles' : `/rest/v1/vehicles?id=eq.${encodeURIComponent(id)}`; data = { name, registration_reference: registration || null, capacity, is_active: active }; entityId = id || null;
      } else if (resource === 'drivers') {
        const fullName = safeText(body.fullName, 120); const phone = safeText(body.phone, 30); const licence = safeText(body.licenceReference, 120); const userId = body.userId ? safeText(body.userId, 36) : null; const active = body.isActive !== false;
        if (fullName.length < 2 || (phone && !/^[0-9+() -]{7,30}$/.test(phone)) || (userId && !isUuid(userId))) return json(res, 400, { error: 'Invalid driver details.' });
        endpoint = req.method === 'POST' ? '/rest/v1/drivers' : `/rest/v1/drivers?id=eq.${encodeURIComponent(id)}`; data = { full_name: fullName, phone: phone || null, licence_reference: licence || null, user_id: userId, is_active: active }; entityId = id || null;
      } else if (resource === 'pickup_locations') {
        const name = safeText(body.name, 160); const address = safeText(body.address, 500); const instructions = safeText(body.instructions, 1000); const active = body.isActive !== false;
        if (name.length < 2) return json(res, 400, { error: 'A pickup location name is required.' });
        endpoint = req.method === 'POST' ? '/rest/v1/pickup_locations' : `/rest/v1/pickup_locations?id=eq.${encodeURIComponent(id)}`; data = { name, address: address || null, instructions: instructions || null, is_active: active }; entityId = id || null;
      } else return json(res, 405, { error: 'This operations record is server-generated and cannot be edited here.' });
    }
    const rows = await supabaseRequest(endpoint, { method: req.method, headers: { Prefer: 'return=representation' }, body: data });
    await supabaseRequest('/rest/v1/audit_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { actor_id: admin.id, action: `${resource}_${req.method === 'POST' ? 'created' : 'updated'}`, entity_type: resource, entity_id: entityId, after_state: data } });
    json(res, req.method === 'POST' ? 201 : 200, { record: Array.isArray(rows) ? rows[0] : null });
  } catch (error) { requestError(res, error); }
}
