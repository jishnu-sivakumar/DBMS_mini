import { NextRequest, NextResponse } from 'next/server';
import {
  createBookingRequest,
  getTenantBookings,
  getOwnerBookingRequests,
} from '@/lib/services/booking-service';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * ============================================================================
 * BOOKINGS API ROUTE (MEMBER 2 BOILERPLATE)
 * ============================================================================
 * 
 * Demonstrates:
 * - Tenant booking submission with ACID transaction row-locking
 * - Fetching booking requests for Owner or Tenant
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // 'TENANT' | 'OWNER'
    const userId = searchParams.get('userId');

    if (!userId) {
      // Pick first demo user based on requested role
      const userRes = await query(
        `SELECT id, role, full_name FROM users WHERE role = $1 LIMIT 1`,
        [role === 'OWNER' ? 'OWNER' : 'TENANT']
      );
      if (userRes.rows.length === 0) {
        return NextResponse.json({ bookings: [] });
      }
      const user = userRes.rows[0];
      const bookings =
        user.role === 'OWNER'
          ? await getOwnerBookingRequests(user.id)
          : await getTenantBookings(user.id);

      return NextResponse.json({
        success: true,
        user,
        bookings,
        assignedTo: 'Member 2 (Teammate)',
      });
    }

    const bookings =
      role === 'OWNER'
        ? await getOwnerBookingRequests(userId)
        : await getTenantBookings(userId);

    return NextResponse.json({
      success: true,
      bookings,
      assignedTo: 'Member 2 (Teammate)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.property_id || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required booking parameters' },
        { status: 400 }
      );
    }

    // Default tenant fallback for demo
    let tenantId = body.tenant_id;
    if (!tenantId) {
      const tenantRes = await query(
        `SELECT id FROM users WHERE role = 'TENANT' LIMIT 1`
      );
      tenantId = tenantRes.rows[0]?.id;
    }

    const result = await createBookingRequest({
      property_id: body.property_id,
      tenant_id: tenantId,
      start_date: body.start_date,
      end_date: body.end_date,
      special_requests: body.special_requests,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      bookingId: result.bookingId,
      assignedTo: 'Member 2 (Teammate)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
