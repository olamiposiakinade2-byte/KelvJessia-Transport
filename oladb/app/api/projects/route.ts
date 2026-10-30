import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectInput } from '@/lib/validation';
import { requireApiAdministrator, routeError } from '@/lib/route';

export async function GET() {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const projects = await db.project.findMany({ include: { _count: { select: { vehicles: true, trips: true, bookings: true } } }, orderBy: { createdAt: 'desc' } }); return NextResponse.json({ projects }); } catch (error) { return routeError(error); }
}

export async function POST(request: NextRequest) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const project = await db.project.create({ data: projectInput.parse(await request.json()) }); return NextResponse.json({ project }, { status: 201 }); } catch (error) { return routeError(error); }
}
