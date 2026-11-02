/**
 * Edge-safe JWT helpers (jose). Used by middleware.ts and lib/auth.ts.
 * The secret comes from the JWT_SECRET env var only.
 */
import { SignJWT, jwtVerify } from 'jose';

export type Role = 'OWNER' | 'TENANT' | 'ADMIN';
export type Session = { userId: string; name: string; role: Role };

export const COOKIE = 'propfind_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is missing or too short (min 16 chars)');
  return new TextEncoder().encode(s);
}

export async function createToken(s: Session): Promise<string> {
  return new SignJWT({ name: s.name, role: s.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { userId: payload.sub, name: payload.name as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
