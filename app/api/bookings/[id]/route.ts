import { NextRequest, NextResponse } from 'next/server';
import { updateBookingStatus, getBookingHistory } from '@/lib/services/booking-service';
import { requireRole, denyResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Booking status update (Member 2)
 * - OWNER  may set APPROVED or REJECTED on bookings for their own properties
 * - TENANT may set CANCELLED on their own bookings
 * Ownership is verified again inside the service layer.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireRole('OWNER', 'TENANT');
  if (!session) return denyResponse();

  try {
    const { status } = await request.json();

    const allowed =
      session.role === 'OWNER' ? ['APPROVED', 'REJECTED'] : ['CANCELLED'];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { success: false, error: `As ${session.role.toLowerCase()} you can only set: ${allowed.join(', ')}` },
        { status: 403 }
      );
    }

    const result = await updateBookingStatus(params.id, session.userId, session.role as 'OWNER' | 'TENANT', status);

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

/** Audit trail + payments for one booking (owner of the property or the tenant). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole('OWNER', 'TENANT');
  if (!session) return denyResponse();

  try {
    const history = await getBookingHistory(params.id, session.userId, session.role as 'OWNER' | 'TENANT');
    return NextResponse.json({ success: true, ...history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  }
}
