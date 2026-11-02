import { NextResponse } from 'next/server';
import { getOwnerProperties } from '@/lib/services/property-service';
import { requireRole, denyResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** The logged-in owner's own listings (all statuses) with booking and review counts. */
export async function GET() {
  const session = await requireRole('OWNER', 'ADMIN');
  if (!session) return denyResponse();

  try {
    const properties = await getOwnerProperties(session.userId);
    return NextResponse.json({ success: true, total: properties.length, properties });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
