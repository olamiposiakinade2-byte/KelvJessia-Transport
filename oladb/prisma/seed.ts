import { PrismaClient } from '@prisma/client';

if (process.env.OLADB_ALLOW_DEMO_SEED !== 'true') throw new Error('Set OLADB_ALLOW_DEMO_SEED=true to seed fictional demonstration data.');

const db = new PrismaClient();

async function main() {
  const project = await db.project.upsert({ where: { slug: 'kelvjessia-transport' }, update: {}, create: { name: 'KelvJessia Transport', slug: 'kelvjessia-transport', isDemo: true } });
  const vehicle = await db.vehicle.upsert({ where: { projectId_registration: { projectId: project.id, registration: 'DEMO-KJ-001' } }, update: {}, create: { projectId: project.id, name: 'Demo Passenger Shuttle', registration: 'DEMO-KJ-001', capacity: 18 } });
  const trip = await db.trip.findFirst({ where: { projectId: project.id, vehicleId: vehicle.id, origin: 'Augustine University, Ilara-Epe', destination: 'Lagos', departureAt: new Date('2030-01-10T08:00:00.000Z') } }) ?? await db.trip.create({ data: { projectId: project.id, vehicleId: vehicle.id, origin: 'Augustine University, Ilara-Epe', destination: 'Lagos', departureAt: new Date('2030-01-10T08:00:00.000Z'), seatCapacity: 18, isPublished: false } });
  const booking = await db.booking.upsert({ where: { reference: 'DEMO-KJ-001' }, update: {}, create: { projectId: project.id, tripId: trip.id, reference: 'DEMO-KJ-001', passengerName: 'Amina Demo', passengerPhone: '08000000000', passengerEmail: 'amina@example.test', seatCount: 2, specialRequirements: 'Fictional record only', status: 'PENDING' } });
  const history = await db.bookingStatusHistory.findFirst({ where: { bookingId: booking.id, newStatus: 'PENDING' } });
  if (!history) await db.bookingStatusHistory.create({ data: { bookingId: booking.id, newStatus: 'PENDING', note: 'Fictional demonstration booking seeded locally' } });
  console.log(`Seeded fictional project: ${project.name}`);
}

main().finally(() => db.$disconnect());
