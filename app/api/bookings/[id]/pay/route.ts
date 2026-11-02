import { NextRequest, NextResponse } from 'next/server';
import { payBooking } from '@/lib/services/booking-service';
import { requireRole, denyResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Tenant pays for their own APPROVED booking (transactional). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole('TENANT');
  if (!session) return denyResponse();

  try {
    const { method } = await request.json().catch(() => ({}));
    const result = await payBooking(params.id, session.userId, method);
    return NextResponse.json({ success: true, message: result.message, transactionRef: result.transactionRef });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
