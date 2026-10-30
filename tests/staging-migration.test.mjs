import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const baseline = read('database/002_production_booking_schema.sql');
const upgrade = read('database/003_booking_payments_operations.sql');
const verification = read('database/staging_verification.sql');
const environment = read('.env.example');

assert.match(baseline, /create table public\.bookings/i);
assert.match(upgrade, /Prerequisite: 002_production_booking_schema\.sql only/i);
assert.doesNotMatch(upgrade, /001_initial_schema/i);
assert.match(upgrade, /payments_one_active_attempt_per_booking_idx/i);
assert.match(upgrade, /role in \('customer','admin','staff','driver'\)/i);
assert.match(upgrade, /add primary key \(user_id, role\)/i);
assert.match(upgrade, /for update/i, 'seat and payment state transitions must lock rows');
assert.match(upgrade, /expire_unpaid_reservations/i);
assert.match(upgrade, /recovery_required/i, 'late payments must remain recoverable, not confirm automatically');
assert.match(upgrade, /event_hash.*unique/i, 'webhook events need a replay guard');
assert.match(upgrade, /revoke all on table .* from anon, authenticated/is);
assert.match(upgrade, /revoke all on function .* from public/is);
assert.doesNotMatch(upgrade, /drop function[^;]*cascade/i, 'migration must not cascade-drop dependencies');

for (const migration of [baseline, upgrade]) {
  const securityDefinerFunctions = migration.match(/security definer[^$]+\$\$/gi) ?? [];
  assert.ok(securityDefinerFunctions.length > 0);
  for (const definition of securityDefinerFunctions) {
    assert.match(definition, /set search_path = ''/i, 'security definer functions must pin an empty search path');
  }
}

assert.match(environment, /KELVJESSIA_BOOKINGS_MODE=staging/);
assert.match(environment, /KELVJESSIA_PAYMENTS_TEST_MODE=true/);
assert.match(environment, /PAYSTACK_SECRET_KEY=sk_test_/);
assert.doesNotMatch(environment, /sk_live_|pk_live_/i);
assert.match(verification, /begin read only/i);
assert.match(verification, /rollback;/i);
assert.doesNotMatch(verification, /insert\s+into|update\s+public|delete\s+from/i);

console.log('Staging migration ordering, privilege hardening, test-mode configuration, and read-only verification checks validated.');
