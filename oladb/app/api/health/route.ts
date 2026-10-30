import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiAdministrator } from '@/lib/route';

export async function GET() {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  const startedAt = Date.now();
  try { await db.$queryRaw`SELECT 1`; return NextResponse.json({ status: 'healthy', latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() }); }
  catch { return NextResponse.json({ status: 'unhealthy', checkedAt: new Date().toISOString() }, { status: 503 }); }
}
