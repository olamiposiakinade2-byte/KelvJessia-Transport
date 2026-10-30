import { bookingIntakeEnabled, json, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET' });
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The production admin area is not enabled.' });
  try {
    await requireAdmin(req);
    const id = safeText(new URL(req.url, 'https://placeholder.invalid').searchParams.get('bookingId'), 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'A booking ID is required.' });
    const history = await supabaseRequest(`/rest/v1/booking_status_history?booking_id=eq.${encodeURIComponent(id)}&select=old_status,new_status,note,created_at,changed_by&order=created_at.desc`);
    json(res, 200, { history });
  } catch (error) { requestError(res, error); }
}
