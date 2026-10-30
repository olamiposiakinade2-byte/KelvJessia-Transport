import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { hasAdministratorSession } from './auth';

export async function requireApiAdministrator() {
  if (!(await hasAdministratorSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export function routeError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid request', details: error.flatten().fieldErrors }, { status: 400 });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
}
