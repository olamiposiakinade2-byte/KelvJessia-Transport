import { bookingIntakeEnabled, json, requestError, requireAdmin, safeText, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { allow: 'GET' });
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The protected administration area is not enabled.' });
  try {
    await requireAdmin(req);
    const url = new URL(req.url, 'https://placeholder.invalid'); const status = safeText(url.searchParams.get('status'), 24);
    const params = new URLSearchParams({ select: 'id,provider_reference,amount_kobo,currency,status,provider_transaction_id,verified_at,created_at,bookings!inner(reference,passenger_name,passenger_phone,status)', order: 'created_at.desc', limit: '250' });
    if (status) params.set('status', `eq.${status}`);
    const payments = await supabaseRequest(`/rest/v1/payments?${params}`);
    json(res, 200, { payments });
  } catch (error) { requestError(res, error); }
}
