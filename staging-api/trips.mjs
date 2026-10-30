import { bookingIntakeEnabled, json, requestError, supabaseRequest } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET' });
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'Live bookings are not enabled.' });
  try {
    const trips = await supabaseRequest('/rest/v1/rpc/list_server_trips', { method: 'POST', body: {} });
    json(res, 200, { trips });
  } catch (error) { requestError(res, error); }
}
