import { json, paymentIntakeEnabled, paystackReference, paystackRequest, permitMemoryAttempt, readJson, requestError, safeText, supabaseRequest, verifyTurnstile } from '../_lib.mjs';

const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!paymentIntakeEnabled()) return json(res, 503, { error: 'Test payments are not enabled for this deployment.' });
  if (!permitMemoryAttempt(req)) return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  try {
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL;
    if (!callbackUrl) throw new Error('Server configuration is missing PAYSTACK_CALLBACK_URL');
    const body = await readJson(req);
    const bookingReference = safeText(body.bookingReference, 32);
    const initializationKey = body.idempotencyKey;
    if (!/^KJ-[0-9]{4}-[A-Z0-9]{10}$/.test(bookingReference) || !isUuid(initializationKey)) return json(res, 400, { error: 'Invalid payment request.' });
    await verifyTurnstile(body.turnstileToken, req);
    const rows = await supabaseRequest('/rest/v1/rpc/create_payment_attempt', {
      method: 'POST', body: { p_booking_reference: bookingReference, p_provider_reference: paystackReference(), p_initialization_key: initializationKey }
    });
    const payment = Array.isArray(rows) ? rows[0] : null;
    if (!payment?.provider_reference || !Number.isInteger(payment.amount_kobo)) throw new Error('Payment could not be prepared');
    const provider = await paystackRequest('/transaction/initialize', {
      method: 'POST', body: { email: payment.email, amount: payment.amount_kobo, currency: 'NGN', reference: payment.provider_reference, callback_url: callbackUrl, metadata: { booking_reference: payment.booking_reference } }
    });
    json(res, 201, { payment: { authorizationUrl: provider.authorization_url, reference: payment.provider_reference, amountKobo: payment.amount_kobo, currency: 'NGN', holdExpiresAt: payment.hold_expires_at } });
  } catch (error) { requestError(res, error); }
}
