import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { olaDbTransportTestMode } from '@/lib/transport/config';
import { recordVerifiedPayment, verifyPaystackTransaction } from '@/lib/transport/payments';
import { paymentReferenceInput } from '@/lib/validation';
import { routeError } from '@/lib/route';

export async function POST(request: NextRequest) {
  if (!olaDbTransportTestMode()) return NextResponse.json({ error: 'OlaDB test payments are not enabled.' }, { status: 503 });
  try {
    const { providerReference } = paymentReferenceInput.parse(await request.json());
    const verified = await verifyPaystackTransaction(providerReference);
    const eventHash = crypto.createHash('sha256').update(`verify:${providerReference}:${verified.id ?? ''}:${verified.status ?? ''}:${verified.amount ?? ''}`).digest('hex');
    const result = await recordVerifiedPayment({ providerReference, eventHash, eventType: 'transaction.verify', verified });
    return NextResponse.json({ payment: result });
  } catch (error) { return routeError(error); }
}
