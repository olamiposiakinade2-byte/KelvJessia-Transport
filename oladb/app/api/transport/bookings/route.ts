import { NextRequest, NextResponse } from 'next/server';
import { createHeldBooking } from '@/lib/transport/bookings';
import { olaDbTransportTestMode } from '@/lib/transport/config';
import { transportBookingInput } from '@/lib/validation';
import { routeError } from '@/lib/route';

export async function POST(request: NextRequest) {
  if (!olaDbTransportTestMode()) return NextResponse.json({ error: 'OlaDB test booking intake is not enabled.' }, { status: 503 });
  try {
    const booking = await createHeldBooking(transportBookingInput.parse(await request.json()));
    return NextResponse.json({ booking: { reference: booking.reference, status: booking.status, holdExpiresAt: booking.holdExpiresAt } }, { status: 201 });
  } catch (error) { return routeError(error); }
}
