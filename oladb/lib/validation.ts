import { z } from 'zod';

export const projectInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(60),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).default('ACTIVE')
});

const base = z.object({ id: z.string().cuid() });
export const tableName = z.enum(['vehicles', 'trips', 'bookings', 'payments', 'booking_status_history']);
export const vehicleInput = z.object({ name: z.string().trim().min(2).max(120), registration: z.string().trim().max(40).optional().nullable(), capacity: z.coerce.number().int().min(1).max(200), isActive: z.coerce.boolean().default(true) });
export const tripInput = z.object({ vehicleId: z.string().cuid(), origin: z.string().trim().min(2).max(160), destination: z.string().trim().min(2).max(160), departureAt: z.coerce.date(), seatCapacity: z.coerce.number().int().min(1).max(200), fareKobo: z.coerce.number().int().min(100).max(100_000_000).optional().nullable(), isPublished: z.coerce.boolean().default(false) }).refine(value => value.origin !== value.destination, 'Origin and destination must differ');
export const bookingInput = z.object({ tripId: z.string().cuid(), reference: z.string().trim().regex(/^DEMO-[A-Z0-9-]{4,30}$/), passengerName: z.string().trim().min(2).max(120), passengerPhone: z.string().trim().regex(/^[0-9+() -]{7,30}$/), passengerEmail: z.string().trim().email().max(254).optional().or(z.literal('')).transform(value => value || null), seatCount: z.coerce.number().int().min(1).max(20), specialRequirements: z.string().trim().max(1000).optional().or(z.literal('')).transform(value => value || null), status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).default('PENDING') });
export const historyInput = z.object({ bookingId: z.string().cuid(), newStatus: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']), note: z.string().trim().max(1000).optional().or(z.literal('')).transform(value => value || null) });
export const idInput = base;

export const transportBookingInput = z.object({
  projectId: z.string().cuid(),
  tripId: z.string().cuid(),
  passengerName: z.string().trim().min(2).max(120),
  passengerPhone: z.string().trim().regex(/^[0-9+() -]{7,30}$/),
  passengerEmail: z.string().trim().email().max(254).optional().or(z.literal('')).transform(value => value || null),
  seatCount: z.coerce.number().int().min(1).max(20),
  specialRequirements: z.string().trim().max(1000).optional().or(z.literal('')).transform(value => value || null),
  idempotencyKey: z.string().uuid()
});
export const paymentInitializeInput = z.object({ bookingReference: z.string().regex(/^KJ-[0-9]{4}-[A-Z0-9]{10}$/), initializationKey: z.string().uuid() });
export const paymentReferenceInput = z.object({ providerReference: z.string().regex(/^KJP-[A-Z0-9-]{12,80}$/) });
