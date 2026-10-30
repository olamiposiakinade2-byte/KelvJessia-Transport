import crypto from 'node:crypto';
import { db } from '@/lib/db';

const HOLD_MINUTES = 15;

export type HeldBookingInput = {
  projectId: string;
  tripId: string;
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string | null;
  seatCount: number;
  specialRequirements?: string | null;
  idempotencyKey: string;
};

export function bookingReference(now = new Date()) {
  return `KJ-${now.getUTCFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

export async function createHeldBooking(input: HeldBookingInput) {
  return db.$transaction(async tx => {
    const existing = await tx.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    // Serialise every capacity decision for this trip. The parameterized raw
    // query is intentional: Prisma has no row-locking API for SELECT FOR UPDATE.
    await tx.$queryRaw`select "id" from "Trip" where "id" = ${input.tripId} for update`;
    const trip = await tx.trip.findFirst({ where: { id: input.tripId, projectId: input.projectId, isPublished: true, departureAt: { gt: new Date() } } });
    if (!trip) throw new Error('Trip is unavailable.');
    if (!trip.fareKobo || trip.fareKobo < 100) throw new Error('Trip has no valid test payment amount.');

    const now = new Date();
    await tx.booking.updateMany({ where: { tripId: trip.id, status: 'PENDING', holdExpiresAt: { lte: now } }, data: { status: 'EXPIRED', holdExpiresAt: null } });
    const seats = await tx.booking.aggregate({
      where: { tripId: trip.id, OR: [{ status: 'CONFIRMED' }, { status: 'PENDING', holdExpiresAt: { gt: now } }] },
      _sum: { seatCount: true }
    });
    if ((seats._sum.seatCount ?? 0) + input.seatCount > trip.seatCapacity) throw new Error('Insufficient seats.');

    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
    const booking = await tx.booking.create({
      data: {
        projectId: input.projectId, tripId: trip.id, reference: bookingReference(now),
        passengerName: input.passengerName, passengerPhone: input.passengerPhone,
        passengerEmail: input.passengerEmail || null, seatCount: input.seatCount,
        specialRequirements: input.specialRequirements || null, status: 'PENDING',
        holdExpiresAt, idempotencyKey: input.idempotencyKey,
        amountKobo: trip.fareKobo * input.seatCount
      }
    });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, newStatus: 'PENDING', note: 'Server-side reservation hold created.' } });
    return booking;
  }, { isolationLevel: 'Serializable' });
}

export async function expireReservationHolds(now = new Date()) {
  return db.$transaction(async tx => {
    const result = await tx.booking.updateMany({ where: { status: 'PENDING', holdExpiresAt: { lte: now } }, data: { status: 'EXPIRED', holdExpiresAt: null } });
    await tx.payment.updateMany({ where: { booking: { status: 'EXPIRED' }, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'EXPIRED' } });
    return result.count;
  });
}
