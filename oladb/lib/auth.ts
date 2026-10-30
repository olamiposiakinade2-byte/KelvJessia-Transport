import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const cookieName = 'oladb_session';
const encoder = new TextEncoder();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
  return encoder.encode(value);
}

export async function isValidAdministrator(email: string, password: string) {
  const configuredEmail = process.env.OLADB_ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.OLADB_ADMIN_PASSWORD_HASH;
  if (!configuredEmail || !hash) return false;
  return email.trim().toLowerCase() === configuredEmail && bcrypt.compare(password, hash);
}

export async function createSession() {
  return new SignJWT({ role: 'administrator' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
}

export async function hasAdministratorSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return payload.role === 'administrator';
  } catch { return false; }
}

export async function requireAdministrator() {
  if (!(await hasAdministratorSession())) redirect('/login');
}

export const sessionCookie = (token: string) => ({
  name: cookieName,
  value: token,
  options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 60 * 60 * 8 }
});

export const clearedSessionCookie = { name: cookieName, value: '', options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 0 } };
