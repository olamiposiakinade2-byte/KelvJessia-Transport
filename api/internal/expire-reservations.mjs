import { json, requestError, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET' });
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) return json(res, 401, { error: 'Unauthorized' });
  try {
    const count = await supabaseRequest('/rest/v1/rpc/expire_unpaid_reservations', { method: 'POST', body: {} });
    json(res, 200, { expiredReservations: Number(count || 0) });
  } catch (error) { requestError(res, error); }
}
