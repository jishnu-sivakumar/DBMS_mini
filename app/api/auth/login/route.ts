import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { setSessionCookie, type Role } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const { rows } = await query<{ id: string; full_name: string; role: Role; password_hash: string }>(
    'SELECT id, full_name, role, password_hash FROM users WHERE email = $1',
    [String(email).toLowerCase().trim()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, role: user.role });
  await setSessionCookie(res, { userId: user.id, name: user.full_name, role: user.role });
  return res;
}
