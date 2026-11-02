import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { setSessionCookie, type Role } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { full_name, email, phone, password, role } = await req.json().catch(() => ({}));

  // Basic checks here; CHECK constraints on the users table are the final guard.
  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  const wanted = String(role || '').toUpperCase();
  if (!['OWNER', 'TENANT'].includes(wanted)) {
    // nobody can self-register as ADMIN
    return NextResponse.json({ error: 'Choose owner or tenant.' }, { status: 400 });
  }

  try {
    const hash = await bcrypt.hash(String(password), 10);
    const { rows } = await query<{ id: string; full_name: string; role: Role }>(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5::user_role)
       RETURNING id, full_name, role`,
      [String(full_name).trim(), String(email).toLowerCase().trim(), phone || null, hash, wanted]
    );
    const user = rows[0];
    const res = NextResponse.json({ success: true, role: user.role }, { status: 201 });
    await setSessionCookie(res, { userId: user.id, name: user.full_name, role: user.role });
    return res;
  } catch (err) {
    const e = err as { code?: string; constraint?: string; message: string };
    const msg =
      e.code === '23505' ? 'An account with this email already exists.'
      : e.constraint === 'users_email_format' ? 'Please enter a valid email address.'
      : e.constraint === 'users_phone_format' ? 'Phone must be 10-15 digits (optional +).'
      : 'Could not create account.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
