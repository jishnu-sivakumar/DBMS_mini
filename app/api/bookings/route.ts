import { NextRequest, NextResponse } from 'next/server';
import {
  createBookingRequest,
  getTenantBookings,
  getOwnerBookingRequests,
} from '@/lib/services/booking-service';
import { requireRole, denyResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Bookings API (Member 2)
 * - GET:  owner -> requests on their properties, tenant -> their own bookings
 * - POST: tenant submits a booking request (ACID transaction + row lock)
 * The user always comes from the JWT session, never from the request body.
 */

export async function GET() {
  const session = await requireRole('OWNER', 'TENANT');
  if (!session) return denyResponse();

  try {
    const bookings =
      session.role === 'OWNER'
        ? await getOwnerBookingRequests(session.userId)
        : await getTenantBookings(session.userId);

    return NextResponse.json({ success: true, role: session.role, bookings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRole('TENANT');
  if (!session) return denyResponse();

  try {
    const body = await request.json();

    if (!body.property_id || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required booking parameters' },
        { status: 400 }
      );
    }

    const result = await createBookingRequest({
      property_id: body.property_id,
      tenant_id: session.userId,
      start_date: body.start_date,
      end_date: body.end_date,
      special_requests: body.special_requests,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      bookingId: result.bookingId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
