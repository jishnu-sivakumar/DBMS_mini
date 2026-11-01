import { NextRequest, NextResponse } from 'next/server';
import { updateBookingStatus } from '@/lib/services/booking-service';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * ============================================================================
 * BOOKING STATUS UPDATE (MEMBER 2 BOILERPLATE)
 * ============================================================================
 * Allows property owners to APPROVE or REJECT a booking request.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    const body = await request.json();
    const { status, owner_id } = body;

    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid booking status' },
        { status: 400 }
      );
    }

    let ownerId = owner_id;
    if (!ownerId) {
      const ownerRes = await query(
        `SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`
      );
      ownerId = ownerRes.rows[0]?.id;
    }

    const result = await updateBookingStatus(bookingId, ownerId, status);

    return NextResponse.json({
      success: true,
      message: result.message,
      assignedTo: 'Member 2 (Teammate)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
