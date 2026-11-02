/**
 * Server-side auth helpers for route handlers and server components.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, COOKIE_MAX_AGE, createToken, verifyToken, type Role, type Session } from '@/lib/jwt';

export type { Role, Session };
export { COOKIE };

/** Current logged-in user, read from the httpOnly session cookie. */
export async function getSession(): Promise<Session | null> {
  return verifyToken(cookies().get(COOKIE)?.value);
}

/** For API routes: returns the session if the user has one of the roles, else null. */
export async function requireRole(...roles: Role[]): Promise<Session | null> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) return null;
  return s;
}

/** Standard 401 / 403 JSON response for a failed requireRole(). */
export async function denyResponse() {
  const s = await getSession();
  return s
    ? NextResponse.json({ success: false, error: 'Forbidden: your role cannot do this' }, { status: 403 })
    : NextResponse.json({ success: false, error: 'Please log in first' }, { status: 401 });
}

/** Attach the signed session cookie (httpOnly) to a response. */
export async function setSessionCookie(res: NextResponse, s: Session) {
  res.cookies.set(COOKIE, await createToken(s), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}
