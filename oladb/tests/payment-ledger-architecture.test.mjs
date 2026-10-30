import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('payment ledger models durable status and replay records', () => {
  const schema = source('prisma/schema.prisma');
  assert.match(schema, /model Payment \{/);
  assert.match(schema, /model PaymentWebhookEvent \{/);
  assert.match(schema, /RECOVERY_REQUIRED/);
  assert.match(schema, /providerReference\s+String\s+@unique/);
  assert.match(schema, /eventHash\s+String\s+@unique/);
});

test('payment verification is server-only, signed, and late-safe', () => {
  const payments = source('lib/transport/payments.ts');
  const webhook = source('app/api/transport/payments/webhook/route.ts');
  assert.match(payments, /crypto\.timingSafeEqual/);
  assert.match(payments, /transaction\/verify/);
  assert.match(payments, /RECOVERY_REQUIRED/);
  assert.match(payments, /for update/);
  assert.match(webhook, /verifyPaystackSignature/);
  assert.match(webhook, /verifyPaystackTransaction/);
  assert.doesNotMatch(payments + webhook, /sk_live_/);
});

test('admin can read payment status but cannot edit payment ledger rows', () => {
  const tables = source('lib/tables.ts');
  const adminPayments = source('app/api/transport/admin/payments/route.ts');
  const dashboard = source('app/dashboard/dashboard-client.tsx');
  assert.match(tables, /payments: 'Payments'/);
  assert.match(tables, /server-managed and cannot be created/);
  assert.match(tables, /Payment and audit history cannot be deleted/);
  assert.match(adminPayments, /requireApiAdministrator/);
  assert.match(dashboard, /'payments'/);
  assert.match(dashboard, /readOnlyTable/);
});

test('database migration includes an active-attempt constraint and no Supabase dependency', () => {
  const migration = source('prisma/migrations/20261030000000_payment_ledger/migration.sql');
  assert.match(migration, /Payment_one_active_attempt_per_booking/);
  assert.match(migration, /Booking_idempotencyKey_key/);
  assert.doesNotMatch(migration.replace(/^--.*$/gm, ''), /supabase|auth\.users|service_role|row level security/i);
});
