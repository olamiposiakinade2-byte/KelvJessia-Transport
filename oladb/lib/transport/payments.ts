import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paystackTestSecret } from './config';

type VerifiedPayment = { id?: string | number; status?: string; amount?: number; currency?: string; [key: string]: unknown };

function providerPayload(value: VerifiedPayment): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function paymentReference(now = new Date()) {
  return `KJP-${now.getUTCFullYear()}-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
}

export function verifyPaystackSignature(rawBody: Buffer, suppliedSignature: string | null) {
  if (!suppliedSignature) return false;
  const expected = crypto.createHmac('sha512', paystackTestSecret()).update(rawBody).digest('hex');
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const actual = Buffer.from(expected, 'utf8');
  return supplied.length === actual.length && crypto.timingSafeEqual(supplied, actual);
}

export async function preparePayment(bookingReference: string, initializationKey: string) {
  return db.$transaction(async tx => {
    const existing = await tx.payment.findUnique({ where: { initializationKey } });
    if (existing) return existing;
    const booking = await tx.booking.findUnique({ where: { reference: bookingReference } });
    if (!booking) throw new Error('Booking was not found.');
    await tx.$queryRaw`select "id" from "Booking" where "id" = ${booking.id} for update`;
    const locked = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    if (locked.status === 'PENDING' && locked.holdExpiresAt && locked.holdExpiresAt <= new Date()) {
      await tx.booking.update({ where: { id: locked.id }, data: { status: 'EXPIRED', holdExpiresAt: null } });
      throw new Error('This reservation has expired.');
    }
    if (locked.status !== 'PENDING' || !locked.passengerEmail || !locked.amountKobo || locked.amountKobo < 100) throw new Error('This booking cannot be paid.');
    const active = await tx.payment.findFirst({ where: { bookingId: locked.id, status: { in: ['PENDING', 'PROCESSING'] } }, orderBy: { createdAt: 'desc' } });
    if (active) return active;
    const providerReference = paymentReference();
    const payment = await tx.payment.create({ data: { projectId: locked.projectId, bookingId: locked.id, providerReference, initializationKey, amountKobo: locked.amountKobo, status: 'PENDING' } });
    await tx.booking.update({ where: { id: locked.id }, data: { paymentReference: providerReference } });
    return payment;
  }, { isolationLevel: 'Serializable' });
}

export async function initializePaystackPayment(payment: { providerReference: string; amountKobo: number; booking: { passengerEmail: string; reference: string } }, callbackUrl: string) {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST', headers: { authorization: `Bearer ${paystackTestSecret()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: payment.booking.passengerEmail, amount: payment.amountKobo, currency: 'NGN', reference: payment.providerReference, callback_url: callbackUrl, metadata: { booking_reference: payment.booking.reference } })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) throw new Error(payload?.message || 'Payment provider initialization failed.');
  await db.payment.update({ where: { providerReference: payment.providerReference }, data: { status: 'PROCESSING' } });
  return payload.data as { authorization_url: string };
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifiedPayment> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${paystackTestSecret()}` } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status || !payload?.data) throw new Error(payload?.message || 'Payment provider verification failed.');
  return payload.data;
}

export async function recordVerifiedPayment(input: { providerReference: string; eventHash: string; eventType: string; verified: VerifiedPayment }) {
  return db.$transaction(async tx => {
    try { await tx.paymentWebhookEvent.create({ data: { provider: 'paystack', eventHash: input.eventHash, providerReference: input.providerReference, eventType: input.eventType } }); }
    catch (error: unknown) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const duplicate = await tx.payment.findUniqueOrThrow({ where: { providerReference: input.providerReference }, include: { booking: true } });
      return { duplicate: true, bookingStatus: duplicate.booking.status, paymentStatus: duplicate.status };
    }

    const payment = await tx.payment.findUnique({ where: { providerReference: input.providerReference }, include: { booking: true } });
    if (!payment) throw new Error('Payment reference was not found.');
    await tx.$queryRaw`select "id" from "Payment" where "id" = ${payment.id} for update`;
    await tx.$queryRaw`select "id" from "Booking" where "id" = ${payment.bookingId} for update`;
    const locked = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { booking: true } });
    if (['SUCCESSFUL', 'RECOVERY_REQUIRED', 'REFUNDED'].includes(locked.status)) return { duplicate: true, bookingStatus: locked.booking.status, paymentStatus: locked.status };

    const transactionId = input.verified.id ? String(input.verified.id) : null;
    const matchingAmount = input.verified.amount === locked.amountKobo && input.verified.currency === 'NGN';
    if (!matchingAmount) {
      await tx.payment.update({ where: { id: locked.id }, data: { status: 'RECOVERY_REQUIRED', providerTransactionId: transactionId, providerPayload: providerPayload(input.verified), verifiedAt: new Date() } });
      return { duplicate: false, bookingStatus: locked.booking.status, paymentStatus: 'RECOVERY_REQUIRED' };
    }
    if (input.verified.status !== 'success') {
      await tx.payment.update({ where: { id: locked.id }, data: { status: 'FAILED', providerTransactionId: transactionId, providerPayload: providerPayload(input.verified), verifiedAt: new Date() } });
      return { duplicate: false, bookingStatus: locked.booking.status, paymentStatus: 'FAILED' };
    }
    if (locked.booking.status === 'PENDING' && locked.booking.holdExpiresAt && locked.booking.holdExpiresAt > new Date()) {
      await tx.payment.update({ where: { id: locked.id }, data: { status: 'SUCCESSFUL', providerTransactionId: transactionId, providerPayload: providerPayload(input.verified), verifiedAt: new Date() } });
      await tx.booking.update({ where: { id: locked.bookingId }, data: { status: 'CONFIRMED', holdExpiresAt: null } });
      await tx.bookingStatusHistory.create({ data: { bookingId: locked.bookingId, oldStatus: 'PENDING', newStatus: 'CONFIRMED', note: 'Verified Paystack test payment.' } });
      return { duplicate: false, bookingStatus: 'CONFIRMED', paymentStatus: 'SUCCESSFUL' };
    }
    if (locked.booking.status === 'PENDING') await tx.booking.update({ where: { id: locked.bookingId }, data: { status: 'EXPIRED', holdExpiresAt: null } });
    await tx.payment.update({ where: { id: locked.id }, data: { status: 'RECOVERY_REQUIRED', providerTransactionId: transactionId, providerPayload: providerPayload(input.verified), verifiedAt: new Date() } });
    return { duplicate: false, bookingStatus: 'EXPIRED', paymentStatus: 'RECOVERY_REQUIRED' };
  }, { isolationLevel: 'Serializable' });
}
