import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiAdministrator, routeError } from '@/lib/route';

export async function GET() {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try {
    const payments = await db.payment.findMany({
      select: { providerReference: true, amountKobo: true, currency: true, status: true, verifiedAt: true, createdAt: true, booking: { select: { reference: true, passengerName: true, status: true } } },
      orderBy: { createdAt: 'desc' }, take: 250
    });
    return NextResponse.json({ payments });
  } catch (error) { return routeError(error); }
}
