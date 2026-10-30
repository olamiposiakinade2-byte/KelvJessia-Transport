import { bookingIntakeEnabled, json, readJson, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

function filters(url) {
  const query = safeText(url.searchParams.get('q'), 80);
  const status = safeText(url.searchParams.get('status'), 20);
  const destination = safeText(url.searchParams.get('destination'), 160);
  const from = safeText(url.searchParams.get('from'), 10);
  const to = safeText(url.searchParams.get('to'), 10);
  const departure = safeText(url.searchParams.get('departure'), 10);
  return { query, status, destination, from, to, departure };
}

async function listBookings(filter) {
  const params = new URLSearchParams({ select: 'id,reference,passenger_name,passenger_phone,passenger_email,seat_count,special_requirements,status,hold_expires_at,created_at,trips!inner(origin,destination,departure_at,vehicles(name))', order: 'created_at.desc', limit: '500' });
  if (filter.status) params.set('status', `eq.${filter.status}`);
  if (filter.from) params.set('trips.departure_at', `gte.${filter.from}T00:00:00.000Z`);
  if (filter.to) params.set('trips.departure_at', `lte.${filter.to}T23:59:59.999Z`);
  if (filter.destination) params.set('trips.destination', `ilike.*${filter.destination.replace(/[*%,()]/g, '')}*`);
  if (filter.departure) params.set('trips.departure_at', `gte.${filter.departure}T00:00:00.000Z`);
  const rows = await supabaseRequest(`/rest/v1/bookings?${params}`);
  return filter.query ? rows.filter(row => Object.values(row).join(' ').toLowerCase().includes(filter.query.toLowerCase())) : rows;
}

export default async function handler(req, res) {
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The production admin area is not enabled.' });
  try {
    const admin = await requireAdmin(req);
    if (req.method === 'GET') return json(res, 200, { bookings: await listBookings(filters(new URL(req.url, 'https://placeholder.invalid'))) });
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET, PATCH' });
    const body = await readJson(req);
    const id = safeText(body.id, 36);
    const status = safeText(body.status, 12);
    const note = safeText(body.note, 1000);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['confirmed', 'cancelled', 'completed'].includes(status)) return json(res, 400, { error: 'Invalid booking status update.' });
    const rows = await supabaseRequest('/rest/v1/rpc/admin_update_server_booking', { method: 'POST', body: { p_booking_id: id, p_new_status: status, p_actor_id: admin.id, p_note: note || null } });
    json(res, 200, { booking: Array.isArray(rows) ? rows[0] : null });
  } catch (error) { requestError(res, error); }
}
