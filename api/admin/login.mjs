import { bookingIntakeEnabled, clearSessionCookie, json, readJson, requestError, safeText, sessionCookie, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  if (!bookingIntakeEnabled()) return json(res, 503, { error: 'The production admin area is not enabled.' });
  try {
    const body = await readJson(req);
    const email = safeText(body.email, 254).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return json(res, 400, { error: 'Enter a valid email address and password.' });
    const session = await supabaseRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    const roles = await supabaseRequest(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(session.user.id)}&role=eq.admin&limit=1`);
    if (!Array.isArray(roles) || roles.length !== 1) {
      return json(res, 403, { error: 'This account is not authorized for booking administration.' }, { 'set-cookie': clearSessionCookie() });
    }
    const maxAge = Math.max(60, Math.min(Number(session.expires_in || 3600), 3600));
    json(res, 200, { admin: { email: session.user.email } }, { 'set-cookie': sessionCookie(session.access_token, maxAge) });
  } catch (error) { requestError(res, error); }
}
