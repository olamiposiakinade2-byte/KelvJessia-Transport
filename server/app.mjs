import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const port = Number(process.env.PORT || 3001);
const db = new DatabaseSync(process.env.KELVJESSIA_DB_PATH || './server/kelvjessia.db');
const allowedOrigin = process.env.KELVJESSIA_ALLOWED_ORIGIN || '';
const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
const paymentTestMode = process.env.KELVJESSIA_PAYMENTS_TEST_MODE === 'true';
const adminToken = process.env.KELVJESSIA_ADMIN_TOKEN || '';

db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY, origin TEXT NOT NULL, destination TEXT NOT NULL,
  departure_at TEXT NOT NULL, total_seats INTEGER NOT NULL CHECK(total_seats > 0),
  available_seats INTEGER NOT NULL CHECK(available_seats >= 0), fare_kobo INTEGER,
  status TEXT NOT NULL DEFAULT 'published'
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, idempotency_key TEXT UNIQUE NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id), passenger_name TEXT NOT NULL,
  passenger_email TEXT, passenger_phone TEXT NOT NULL,
  passenger_count INTEGER NOT NULL CHECK(passenger_count > 0),
  status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  provider_reference TEXT NOT NULL UNIQUE, amount_kobo INTEGER NOT NULL CHECK(amount_kobo > 0),
  currency TEXT NOT NULL DEFAULT 'NGN', status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PAID','FAILED','RECOVERY_REQUIRED')),
  verified_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_hash TEXT PRIMARY KEY, provider_reference TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bookings_trip_status_idx ON bookings(trip_id, status);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);`);

if (!db.prepare('SELECT id FROM trips LIMIT 1').get()) {
  db.prepare('INSERT INTO trips VALUES (?,?,?,?,?,?,?,?)').run(
    'demo-aui-lagos', 'Augustine University, Ilara-Epe', 'Lagos',
    '2030-01-10T08:00:00+01:00', 18, 18, 250000, 'published'
  );
}

const paymentEnabled = () => paymentTestMode && paystackSecret.startsWith('sk_test_');
const json = (res, status, body) => {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (allowedOrigin) headers['access-control-allow-origin'] = allowedOrigin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};
const readRaw = req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100_000) reject(new Error('Request body is too large'));
  });
  req.on('end', () => resolve(body));
  req.on('error', reject);
});
const readJson = async req => {
  const raw = await readRaw(req);
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('Invalid JSON'); }
};
const reference = () => `KJ-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const paymentReference = () => `KJP-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const isAdmin = req => adminToken.length >= 32 && safeEqual(req.headers.authorization || '', `Bearer ${adminToken}`);
const requireAdmin = req => { if (!isAdmin(req)) { const error = new Error('Administrator authorization is required'); error.statusCode = 401; throw error; } };

function reserve(input, key) {
  const existing = db.prepare('SELECT * FROM bookings WHERE idempotency_key=?').get(key);
  if (existing) return existing;
  if (!input.trip_id || !input.passenger_name?.trim() || !input.passenger_phone?.trim() || !Number.isInteger(input.passenger_count) || input.passenger_count < 1) throw new Error('Invalid booking details');
  db.exec('BEGIN IMMEDIATE');
  try {
    const trip = db.prepare("SELECT * FROM trips WHERE id=? AND status='published'").get(input.trip_id);
    if (!trip) throw new Error('Trip unavailable');
    if (trip.available_seats < input.passenger_count) throw new Error('Insufficient seats');
    db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(input.passenger_count, trip.id);
    const booking = {
      id: crypto.randomUUID(), reference: reference(), idempotency_key: key, trip_id: trip.id,
      passenger_name: input.passenger_name.trim(), passenger_email: input.passenger_email?.trim() || null,
      passenger_phone: input.passenger_phone.trim(), passenger_count: input.passenger_count, status: 'PENDING'
    };
    db.prepare('INSERT INTO bookings(id,reference,idempotency_key,trip_id,passenger_name,passenger_email,passenger_phone,passenger_count,status) VALUES(@id,@reference,@idempotency_key,@trip_id,@passenger_name,@passenger_email,@passenger_phone,@passenger_count,@status)').run(booking);
    db.exec('COMMIT');
    return booking;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

async function paystack(path, payload) {
  if (!paymentEnabled()) { const error = new Error('Paystack test payments are not configured'); error.statusCode = 503; throw error; }
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${paystackSecret}`, ...(payload ? { 'content-type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.status) { const error = new Error(body.message || 'Paystack request failed'); error.statusCode = 502; throw error; }
  return body.data;
}

async function createPaymentLink(booking) {
  if (booking.status !== 'CONFIRMED') { const error = new Error('Only confirmed bookings can be paid'); error.statusCode = 409; throw error; }
  if (!booking.passenger_email) { const error = new Error('The confirmed booking needs a passenger email before payment'); error.statusCode = 409; throw error; }
  const fare = Number(booking.fare_kobo) * Number(booking.passenger_count);
  if (!Number.isInteger(fare) || fare < 1) { const error = new Error('A valid trip fare is required before payment'); error.statusCode = 409; throw error; }
  const existing = db.prepare("SELECT * FROM payments WHERE booking_id=? AND status='PENDING'").get(booking.id);
  if (existing) return { reference: existing.provider_reference, authorizationUrl: null, existing: true };
  const providerReference = paymentReference();
  const initialized = await paystack('/transaction/initialize', {
    email: booking.passenger_email, amount: fare, currency: 'NGN', reference: providerReference,
    callback_url: process.env.PAYSTACK_CALLBACK_URL || undefined,
    metadata: { bookingReference: booking.reference }
  });
  if (!initialized.authorization_url || initialized.reference !== providerReference) throw new Error('Paystack returned an invalid payment initialization');
  db.prepare('INSERT INTO payments(id,booking_id,provider_reference,amount_kobo,currency,status) VALUES(?,?,?,?,?,?)').run(
    crypto.randomUUID(), booking.id, providerReference, fare, 'NGN', 'PENDING'
  );
  return { reference: providerReference, authorizationUrl: initialized.authorization_url, existing: false };
}

async function applyVerification(providerReference, source, eventHash = null) {
  const verified = await paystack(`/transaction/verify/${encodeURIComponent(providerReference)}`);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (eventHash && db.prepare('SELECT event_hash FROM payment_webhook_events WHERE event_hash=?').get(eventHash)) { db.exec('COMMIT'); return { duplicate: true }; }
    const payment = db.prepare('SELECT payments.*, bookings.status AS booking_status FROM payments JOIN bookings ON bookings.id=payments.booking_id WHERE provider_reference=?').get(providerReference);
    if (!payment) throw new Error('Payment reference is not recognized');
    const valid = payment.booking_status === 'CONFIRMED' && verified.status === 'success' && Number(verified.amount) === Number(payment.amount_kobo) && verified.currency === 'NGN' && verified.reference === payment.provider_reference;
    if (eventHash) db.prepare('INSERT INTO payment_webhook_events(event_hash,provider_reference) VALUES(?,?)').run(eventHash, providerReference);
    if (!valid) {
      db.prepare("UPDATE payments SET status='RECOVERY_REQUIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='PAID'").run(payment.id);
      db.exec('COMMIT');
      return { status: 'RECOVERY_REQUIRED', source };
    }
    db.prepare("UPDATE payments SET status='PAID',verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(payment.id);
    db.prepare("UPDATE bookings SET status='PAID' WHERE id=? AND status='CONFIRMED'").run(payment.booking_id);
    db.exec('COMMIT');
    return { status: 'PAID', source };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      const headers = { 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type,idempotency-key,authorization' };
      if (allowedOrigin) headers['access-control-allow-origin'] = allowedOrigin;
      res.writeHead(204, headers); return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, paymentsTestMode: paymentEnabled() });
    if (req.method === 'GET' && url.pathname === '/api/trips') return json(res, 200, { trips: db.prepare("SELECT * FROM trips WHERE status='published' ORDER BY departure_at").all() });
    if (req.method === 'POST' && url.pathname === '/api/bookings') {
      const key = req.headers['idempotency-key'];
      if (!key || typeof key !== 'string') return json(res, 400, { error: 'Idempotency-Key header is required' });
      return json(res, 201, { booking: reserve(await readJson(req), key) });
    }
    const lookup = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
    if (req.method === 'GET' && lookup) {
      const phone = url.searchParams.get('phone')?.trim();
      if (!phone) return json(res, 400, { error: 'Phone is required' });
      const booking = db.prepare('SELECT reference,trip_id,passenger_count,status,created_at FROM bookings WHERE reference=? AND passenger_phone=?').get(decodeURIComponent(lookup[1]), phone);
      return booking ? json(res, 200, { booking }) : json(res, 404, { error: 'Booking not found' });
    }
    const adminBooking = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/(confirm|payment-link)$/);
    if (req.method === 'POST' && adminBooking) {
      requireAdmin(req);
      const booking = db.prepare('SELECT bookings.*,trips.fare_kobo FROM bookings JOIN trips ON trips.id=bookings.trip_id WHERE bookings.reference=?').get(decodeURIComponent(adminBooking[1]));
      if (!booking) return json(res, 404, { error: 'Booking not found' });
      if (adminBooking[2] === 'confirm') {
        if (booking.status !== 'PENDING') return json(res, 409, { error: 'Only pending bookings can be confirmed' });
        db.prepare("UPDATE bookings SET status='CONFIRMED' WHERE id=?").run(booking.id);
        return json(res, 200, { booking: { reference: booking.reference, status: 'CONFIRMED' } });
      }
      return json(res, 201, { payment: await createPaymentLink(booking) });
    }
    if (req.method === 'POST' && url.pathname === '/api/payments/verify') {
      const body = await readJson(req);
      if (typeof body.reference !== 'string' || body.reference.length > 100) return json(res, 400, { error: 'A valid payment reference is required' });
      return json(res, 200, { payment: await applyVerification(body.reference, 'customer-return') });
    }
    if (req.method === 'POST' && url.pathname === '/api/payments/paystack-webhook') {
      const raw = await readRaw(req);
      const signature = req.headers['x-paystack-signature'];
      const expected = crypto.createHmac('sha512', paystackSecret).update(raw).digest('hex');
      if (!paymentEnabled() || !safeEqual(signature, expected)) return json(res, 401, { error: 'Invalid webhook signature' });
      const event = JSON.parse(raw);
      if (event.event !== 'charge.success' || typeof event.data?.reference !== 'string') return json(res, 200, { ignored: true });
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      if (db.prepare('SELECT event_hash FROM payment_webhook_events WHERE event_hash=?').get(hash)) return json(res, 200, { payment: { duplicate: true } });
      return json(res, 200, { payment: await applyVerification(event.data.reference, 'webhook', hash) });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/payments') {
      requireAdmin(req);
      return json(res, 200, { payments: db.prepare('SELECT payments.provider_reference,payments.amount_kobo,payments.currency,payments.status,payments.verified_at,bookings.reference AS booking_reference FROM payments JOIN bookings ON bookings.id=payments.booking_id ORDER BY payments.created_at DESC').all() });
    }
    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = error.statusCode || (error.message.includes('Insufficient') || error.message.includes('Invalid') ? 400 : 500);
    return json(res, status, { error: status >= 500 ? 'The request could not be completed' : error.message });
  }
});

server.listen(port, () => console.log(`KelvJessia API listening on http://localhost:${port}`));
