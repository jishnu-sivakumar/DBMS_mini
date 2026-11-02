import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(COOKIE);
  return res;
}
