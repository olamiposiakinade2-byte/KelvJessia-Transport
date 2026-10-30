import crypto from 'node:crypto';
import { json, paymentIntakeEnabled, paystackRequest, readRaw, requestError, supabaseRequest, verifyPaystackSignature } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!paymentIntakeEnabled()) return json(res, 503, { error: 'Payment webhooks are not enabled.' });
  try {
    const raw = await readRaw(req);
    if (!verifyPaystackSignature(raw, req.headers['x-paystack-signature'])) return json(res, 401, { error: 'Invalid webhook signature.' });
    const event = JSON.parse(raw.toString('utf8'));
    if (event?.event !== 'charge.success' || !event?.data?.reference) return json(res, 200, { received: true, ignored: true });
    const reference = String(event.data.reference);
    const verified = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const eventHash = crypto.createHash('sha256').update(raw).digest('hex');
    await supabaseRequest('/rest/v1/rpc/record_verified_payment', {
      method: 'POST', body: { p_provider_reference: reference, p_event_hash: eventHash, p_provider_transaction_id: String(verified.id || ''), p_gateway_status: verified.status, p_gateway_amount_kobo: verified.amount, p_gateway_currency: verified.currency, p_payload: verified }
    });
    json(res, 200, { received: true });
  } catch (error) { requestError(res, error); }
}
