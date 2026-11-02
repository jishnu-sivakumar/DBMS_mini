/**
 * Role-based access control: runs before every protected page loads.
 * (API routes additionally re-check the role themselves via requireRole().)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE, type Role } from '@/lib/jwt';

const rules: { prefix: string; roles: Role[] }[] = [
  { prefix: '/dashboard/owner', roles: ['OWNER', 'ADMIN'] },
  { prefix: '/dashboard/tenant', roles: ['TENANT', 'ADMIN'] },
  { prefix: '/properties/new', roles: ['OWNER', 'ADMIN'] },
];

export async function middleware(req: NextRequest) {
  const rule = rules.find((r) => req.nextUrl.pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const session = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (!session) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/properties/new'],
};
