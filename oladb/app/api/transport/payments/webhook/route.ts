import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { olaDbTransportTestMode } from '@/lib/transport/config';
import { recordVerifiedPayment, verifyPaystackSignature, verifyPaystackTransaction } from '@/lib/transport/payments';
import { routeError } from '@/lib/route';

export async function POST(request: NextRequest) {
  if (!olaDbTransportTestMode()) return NextResponse.json({ error: 'OlaDB test payments are not enabled.' }, { status: 503 });
  try {
    const raw = Buffer.from(await request.arrayBuffer());
    if (!verifyPaystackSignature(raw, request.headers.get('x-paystack-signature'))) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    const event = JSON.parse(raw.toString('utf8')) as { event?: string; data?: { reference?: string } };
    if (event.event !== 'charge.success' || !event.data?.reference) return NextResponse.json({ received: true, ignored: true });
    const verified = await verifyPaystackTransaction(event.data.reference);
    await recordVerifiedPayment({ providerReference: event.data.reference, eventHash: crypto.createHash('sha256').update(raw).digest('hex'), eventType: event.event, verified });
    return NextResponse.json({ received: true });
  } catch (error) { return routeError(error); }
}
