export function olaDbTransportTestMode() {
  return process.env.OLADB_TRANSPORT_MODE === 'staging' && process.env.OLADB_STAGING_PROTECTED === 'true' && process.env.OLADB_PAYSTACK_TEST_MODE === 'true';
}

export function requiredServerEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

export function paystackTestSecret() {
  const key = requiredServerEnvironment('PAYSTACK_SECRET_KEY');
  if (!key.startsWith('sk_test_')) throw new Error('Only a Paystack test secret key may be used by OlaDB staging.');
  return key;
}
