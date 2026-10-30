import { NextResponse } from 'next/server';
import { clearedSessionCookie } from '@/lib/auth';

export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set(clearedSessionCookie.name, clearedSessionCookie.value, clearedSessionCookie.options); return response; }
