import { clearSessionCookie, cookieValue, json, supabaseRequest } from '../_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { allow: 'POST' });
  const token = cookieValue(req, 'kj_admin_access');
  try { if (token) await supabaseRequest('/auth/v1/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }); } catch { /* Session is cleared regardless. */ }
  json(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
}
