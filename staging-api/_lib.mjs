import crypto from 'node:crypto';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const memoryRateLimits = globalThis.__kelvjessiaRateLimits || (globalThis.__kelvjessiaRateLimits = new Map());

export function json(res, status, body, headers = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...headers });
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { throw new Error('Invalid JSON'); }
}

export async function readRaw(req, maxBytes = 200_000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) { const error = new Error('Request body is too large'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function bookingMode() { return process.env.KELVJESSIA_BOOKINGS_MODE || 'demo'; }
export function bookingIntakeEnabled() {
  const mode = bookingMode();
  return (mode === 'staging' && process.env.KELVJESSIA_STAGING_PROTECTED === 'true') ||
    (mode === 'live' && process.env.KELVJESSIA_REAL_BOOKING_APPROVED === 'true');
}

// Stored enquiries and payment flows are staging/test-mode only until the
// company separately approves a production launch.
export function protectedStagingEnabled() { return bookingMode() === 'staging' && process.env.KELVJESSIA_STAGING_PROTECTED === 'true'; }
export function paymentIntakeEnabled() { return protectedStagingEnabled() && process.env.KELVJESSIA_PAYMENTS_TEST_MODE === 'true' && Boolean(process.env.PAYSTACK_SECRET_KEY); }
export function enquiryIntakeEnabled() { return protectedStagingEnabled(); }

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Server configuration is missing ${name}`);
  return value;
}

function supabaseConfig() {
  return { url: required('SUPABASE_URL').replace(/\/$/, ''), serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY') };
}

export async function supabaseRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const { url, serviceRoleKey } = supabaseConfig();
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || 'Database request failed');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
}

export function requestFingerprint(req) {
  const salt = required('BOOKING_RATE_LIMIT_SALT');
  return crypto.createHash('sha256').update(`${salt}:${clientIp(req)}`).digest('hex');
}

export function permitMemoryAttempt(req) {
  const key = crypto.createHash('sha256').update(clientIp(req)).digest('hex');
  const now = Date.now();
  const prior = (memoryRateLimits.get(key) || []).filter(time => now - time < 60_000);
  if (prior.length >= 12) return false;
  prior.push(now);
  memoryRateLimits.set(key, prior);
  return true;
}

export async function verifyTurnstile(token, req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (bookingMode() !== 'live' && !secret) return;
  if (!secret || !token || typeof token !== 'string') {
    const error = new Error('Bot verification is required'); error.status = 400; throw error;
  }
  const body = new URLSearchParams({ secret, response: token, remoteip: clientIp(req) });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const result = await response.json();
  if (!result.success) { const error = new Error('Bot verification failed'); error.status = 400; throw error; }
}

export function cookieValue(req, name) {
  const match = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookie(token, maxAge) {
  return `kj_admin_access=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return 'kj_admin_access=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

export async function requireRole(req, allowedRoles = ['admin']) {
  const accessToken = cookieValue(req, 'kj_admin_access');
  if (!accessToken) { const error = new Error('Sign in is required'); error.status = 401; throw error; }
  const { url, serviceRoleKey } = supabaseConfig();
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${accessToken}` } });
  if (!userResponse.ok) { const error = new Error('Your session has expired'); error.status = 401; throw error; }
  const user = await userResponse.json();
  const requested = allowedRoles.map(role => `role.eq.${encodeURIComponent(role)}`).join(',');
  const roleRows = await supabaseRequest(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&or=(${requested})&limit=5`);
  if (!Array.isArray(roleRows) || !roleRows.some(row => allowedRoles.includes(row.role))) { const error = new Error('Authorized staff access is required'); error.status = 403; throw error; }
  return user;
}

export async function requireAdmin(req) { return requireRole(req, ['admin']); }

export function paystackReference() { return `KJP-${new Date().getUTCFullYear()}-${crypto.randomBytes(10).toString('hex').toUpperCase()}`; }
function paystackSecret() { return required('PAYSTACK_SECRET_KEY'); }
export async function paystackRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: { authorization: `Bearer ${paystackSecret()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status) { const error = new Error(payload?.message || 'Payment provider request failed'); error.status = 502; throw error; }
  return payload.data;
}
export function verifyPaystackSignature(rawBody, signature) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha512', paystackSecret()).update(rawBody).digest('hex');
  const supplied = Buffer.from(signature, 'utf8'); const actual = Buffer.from(expected, 'utf8');
  return supplied.length === actual.length && crypto.timingSafeEqual(supplied, actual);
}

export function safeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

export function requestError(res, error) {
  const status = error?.status || (String(error?.message).includes('Insufficient seats') ? 409 : 500);
  const message = status >= 500 ? 'The booking service is temporarily unavailable.' : error.message;
  json(res, status, { error: message });
}
