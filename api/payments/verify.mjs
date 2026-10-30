import crypto from 'node:crypto';
import { json, paymentIntakeEnabled, paystackRequest, permitMemoryAttempt, readJson, requestError, safeText, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!paymentIntakeEnabled()) return json(res, 503, { error: 'Test payments are not enabled for this deployment.' });
  if (!permitMemoryAttempt(req)) return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  try {
    const { providerReference } = await readJson(req);
    const reference = safeText(providerReference, 90);
    if (!/^KJP-[A-Z0-9-]{12,80}$/.test(reference)) return json(res, 400, { error: 'Invalid payment reference.' });
    const verified = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const eventHash = crypto.createHash('sha256').update(`verify:${reference}:${verified.id}:${verified.status}:${verified.amount}`).digest('hex');
    const rows = await supabaseRequest('/rest/v1/rpc/record_verified_payment', {
      method: 'POST', body: { p_provider_reference: reference, p_event_hash: eventHash, p_provider_transaction_id: String(verified.id || ''), p_gateway_status: verified.status, p_gateway_amount_kobo: verified.amount, p_gateway_currency: verified.currency, p_payload: verified }
    });
    const result = Array.isArray(rows) ? rows[0] : null;
    if (!result) throw new Error('Payment verification could not be recorded');
    json(res, 200, { payment: { bookingReference: result.booking_reference, bookingStatus: result.booking_status, status: result.payment_status } });
  } catch (error) { requestError(res, error); }
}
