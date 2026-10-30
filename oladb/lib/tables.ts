import { db } from './db';
import { bookingInput, historyInput, tripInput, vehicleInput } from './validation';

export const tableLabels = { vehicles: 'Vehicles', trips: 'Trips', bookings: 'Bookings', payments: 'Payments', booking_status_history: 'Status history' } as const;
export type TableName = keyof typeof tableLabels;

export async function listRows(projectId: string, table: TableName) {
  if (table === 'vehicles') return db.vehicle.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  if (table === 'trips') return db.trip.findMany({ where: { projectId }, include: { vehicle: { select: { name: true } } }, orderBy: { departureAt: 'desc' } });
  if (table === 'bookings') return db.booking.findMany({ where: { projectId }, include: { trip: { select: { origin: true, destination: true, departureAt: true } } }, orderBy: { createdAt: 'desc' } });
  if (table === 'payments') return db.payment.findMany({ where: { projectId }, select: { id: true, providerReference: true, amountKobo: true, currency: true, status: true, verifiedAt: true, createdAt: true, booking: { select: { reference: true, passengerName: true } } }, orderBy: { createdAt: 'desc' } });
  return db.bookingStatusHistory.findMany({ where: { booking: { projectId } }, include: { booking: { select: { reference: true } } }, orderBy: { changedAt: 'desc' } });
}

export async function createRow(projectId: string, table: TableName, input: unknown) {
  if (table === 'vehicles') return db.vehicle.create({ data: { projectId, ...vehicleInput.parse(input) } });
  if (table === 'trips') { const data = tripInput.parse(input); const vehicle = await db.vehicle.findFirst({ where: { id: data.vehicleId, projectId } }); if (!vehicle) throw new Error('Vehicle is not available in this project.'); return db.trip.create({ data: { projectId, ...data } }); }
  if (table === 'bookings') { const data = bookingInput.parse(input); const trip = await db.trip.findFirst({ where: { id: data.tripId, projectId } }); if (!trip) throw new Error('Trip is not available in this project.'); return db.$transaction(async tx => { const booking = await tx.booking.create({ data: { projectId, ...data } }); await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, newStatus: booking.status, note: 'Demo booking created by administrator' } }); return booking; }); }
  throw new Error('Payments and status history are server-managed and cannot be created in the table editor.');
}

export async function updateRow(projectId: string, table: TableName, id: string, input: unknown) {
  if (table === 'vehicles') { const record = await db.vehicle.findFirst({ where: { id, projectId } }); if (!record) throw new Error('Vehicle was not found.'); return db.vehicle.update({ where: { id }, data: vehicleInput.parse(input) }); }
  if (table === 'trips') { const record = await db.trip.findFirst({ where: { id, projectId } }); if (!record) throw new Error('Trip was not found.'); const data = tripInput.parse(input); const vehicle = await db.vehicle.findFirst({ where: { id: data.vehicleId, projectId } }); if (!vehicle) throw new Error('Vehicle is not available in this project.'); return db.trip.update({ where: { id }, data }); }
  if (table === 'bookings') { const data = bookingInput.parse(input); const existing = await db.booking.findFirst({ where: { id, projectId } }); if (!existing) throw new Error('Booking was not found.'); const trip = await db.trip.findFirst({ where: { id: data.tripId, projectId } }); if (!trip) throw new Error('Trip is not available in this project.'); return db.$transaction(async tx => { const booking = await tx.booking.update({ where: { id }, data }); if (existing.status !== data.status) await tx.bookingStatusHistory.create({ data: { bookingId: id, oldStatus: existing.status, newStatus: data.status, note: 'Demo status changed by administrator' } }); return booking; }); }
  historyInput.parse(input);
  throw new Error('Status history is immutable; payments are also immutable in the table editor.');
}

export async function deleteRow(projectId: string, table: TableName, id: string) {
  if (table === 'booking_status_history' || table === 'payments') throw new Error('Payment and audit history cannot be deleted.');
  if (table === 'vehicles') { const record = await db.vehicle.findFirst({ where: { id, projectId } }); if (!record) throw new Error('Vehicle was not found.'); return db.vehicle.delete({ where: { id } }); }
  if (table === 'trips') { const record = await db.trip.findFirst({ where: { id, projectId } }); if (!record) throw new Error('Trip was not found.'); return db.trip.delete({ where: { id } }); }
  const record = await db.booking.findFirst({ where: { id, projectId } }); if (!record) throw new Error('Booking was not found.'); return db.booking.delete({ where: { id } });
}
