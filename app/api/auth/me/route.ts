import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Returns the logged-in user (from the JWT cookie) or null. Used by the navbar. */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ user: session });
}
