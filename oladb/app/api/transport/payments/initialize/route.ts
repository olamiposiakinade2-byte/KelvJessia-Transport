import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { olaDbTransportTestMode, requiredServerEnvironment } from '@/lib/transport/config';
import { initializePaystackPayment, preparePayment } from '@/lib/transport/payments';
import { paymentInitializeInput } from '@/lib/validation';
import { routeError } from '@/lib/route';

export async function POST(request: NextRequest) {
  if (!olaDbTransportTestMode()) return NextResponse.json({ error: 'OlaDB test payments are not enabled.' }, { status: 503 });
  try {
    const input = paymentInitializeInput.parse(await request.json());
    const prepared = await preparePayment(input.bookingReference, input.initializationKey);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: prepared.id }, include: { booking: { select: { passengerEmail: true, reference: true } } } });
    if (!payment.booking.passengerEmail) throw new Error('An email address is required for payment.');
    const callbackUrl = new URL(requiredServerEnvironment('PAYSTACK_CALLBACK_URL'));
    if (callbackUrl.protocol !== 'https:') throw new Error('PAYSTACK_CALLBACK_URL must use HTTPS.');
    const provider = await initializePaystackPayment({ ...payment, booking: { passengerEmail: payment.booking.passengerEmail, reference: payment.booking.reference } }, callbackUrl.toString());
    return NextResponse.json({ payment: { reference: payment.providerReference, amountKobo: payment.amountKobo, currency: payment.currency, authorizationUrl: provider.authorization_url } }, { status: 201 });
  } catch (error) { return routeError(error); }
}
