import crypto from 'node:crypto';
import { enquiryIntakeEnabled, json, permitMemoryAttempt, readJson, requestError, requestFingerprint, safeText, supabaseRequest, verifyTurnstile } from './_lib.mjs';

const categories = new Set(['booking_assistance', 'payment_issues', 'pickup_information', 'dropoff_information', 'refund_requests', 'general_enquiries', 'complaints']);
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const phone = value => /^[0-9+() -]{7,30}$/.test(value);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!enquiryIntakeEnabled()) return json(res, 503, { error: 'Stored enquiries are not enabled. Please contact the team through WhatsApp.' });
  if (!permitMemoryAttempt(req)) return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  try {
    const body = await readJson(req);
    const fullName = safeText(body.fullName, 120);
    const customerEmail = safeText(body.email, 254).toLowerCase();
    const customerPhone = safeText(body.phone, 30);
    const category = safeText(body.category, 40);
    const subject = safeText(body.subject, 180);
    const message = safeText(body.message, 4000);
    if (fullName.length < 2 || !email(customerEmail) || !phone(customerPhone) || !categories.has(category) || subject.length < 3 || message.length < 10) {
      return json(res, 400, { error: 'Please complete each enquiry field correctly.' });
    }
    await verifyTurnstile(body.turnstileToken, req);
    const reference = await supabaseRequest('/rest/v1/rpc/create_customer_enquiry', {
      method: 'POST',
      body: { p_full_name: fullName, p_email: customerEmail, p_phone: customerPhone, p_category: category, p_subject: subject, p_message: message, p_request_fingerprint: requestFingerprint(req) }
    });
    json(res, 201, { enquiry: { reference: typeof reference === 'string' ? reference : String(reference) }, message: 'Your enquiry has been submitted successfully. Our team will respond as soon as possible.' });
  } catch (error) { requestError(res, error); }
}
