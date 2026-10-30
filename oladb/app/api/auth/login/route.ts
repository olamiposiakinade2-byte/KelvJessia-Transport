import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, isValidAdministrator, sessionCookie } from '@/lib/auth';

const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(256) });

export async function POST(request: NextRequest) {
  try {
    const { email, password } = input.parse(await request.json());
    if (!(await isValidAdministrator(email, password))) return NextResponse.json({ error: 'Invalid administrator credentials.' }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    const cookie = sessionCookie(await createSession()); response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch { return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 }); }
}
