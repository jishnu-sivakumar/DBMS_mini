/**
 * ============================================================================
 * BOOKING & RENTAL MANAGEMENT SERVICE
 * Assigned to: MEMBER 2 (Teammate Scope)
 * ============================================================================
 * 
 * Responsibilities for Member 2:
 * 1. ACID Transaction implementation for rental booking creation.
 * 2. Concurrency control: Row-level locking ('SELECT ... FOR UPDATE') to prevent double-booking.
 * 3. Booking approval state machine: PENDING -> APPROVED | REJECTED | CANCELLED.
 * 4. Stored function integration: 'fn_check_booking_conflict' to detect overlapping dates.
 */

import { query, withTransaction } from '@/lib/db';

export interface BookingRequestInput {
  property_id: string;
  tenant_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  special_requests?: string;
}

export interface BookingRecord {
  id: string;
  property_id: string;
  property_title?: string;
  property_city?: string;
  tenant_id: string;
  tenant_name?: string;
  tenant_email?: string;
  owner_id?: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  special_requests?: string;
  created_at: string;
}

/**
 * ----------------------------------------------------------------------------
 * 1. Create a Rental Booking Request (Transactional Concurrency)
 * ----------------------------------------------------------------------------
 * TODO for Member 2:
 * - Execute inside an ACID transaction block using `withTransaction`.
 * - Lock the property row with `FOR UPDATE` to serialize concurrent requests.
 * - Call `fn_check_booking_conflict(property_id, start_date, end_date)`.
 * - Compute `total_amount = (months between dates) * price_per_month`.
 * - Insert into `bookings` with status 'PENDING'.
 */
export async function createBookingRequest(
  data: BookingRequestInput
): Promise<{ success: boolean; bookingId?: string; message: string }> {
  return await withTransaction(async (client) => {
    // Step 1: Concurrency Control - Lock the property record
    const propCheck = await client.query(
      `SELECT id, price_per_month, status 
       FROM properties 
       WHERE id = $1 
       FOR UPDATE`,
      [data.property_id]
    );

    if (propCheck.rows.length === 0) {
      throw new Error('Property not found');
    }

    const property = propCheck.rows[0];
    if (property.status !== 'AVAILABLE') {
      throw new Error(`Property is currently ${property.status} and cannot be booked`);
    }

    // Step 2: Date conflict check using stored procedure
    const conflictCheck = await client.query(
      `SELECT fn_check_booking_conflict($1, $2::date, $3::date) AS has_conflict`,
      [data.property_id, data.start_date, data.end_date]
    );

    if (conflictCheck.rows[0]?.has_conflict) {
      throw new Error('Property has an overlapping confirmed booking for these dates');
    }

    // Step 3: Calculate duration and total rental amount
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.round(diffDays / 30));
    const totalAmount = Number(property.price_per_month) * months;

    // Step 4: Insert booking record
    const insertRes = await client.query(
      `INSERT INTO bookings (
        property_id, tenant_id, start_date, end_date, total_amount, status, special_requests
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      RETURNING id`,
      [
        data.property_id,
        data.tenant_id,
        data.start_date,
        data.end_date,
        totalAmount,
        data.special_requests || null,
      ]
    );

    return {
      success: true,
      bookingId: insertRes.rows[0].id,
      message: 'Booking request created successfully. Awaiting owner approval.',
    };
  });
}

/**
 * ----------------------------------------------------------------------------
 * 2. Get Bookings for a Tenant (Tenant History)
 * ----------------------------------------------------------------------------
 * TODO for Member 2:
 * - Query bookings joined with property title, address, image_url
 * - Order by start_date DESC
 */
export async function getTenantBookings(tenantId: string): Promise<BookingRecord[]> {
  const result = await query<BookingRecord>(
    `SELECT 
      b.id,
      b.property_id,
      p.title AS property_title,
      p.city AS property_city,
      b.tenant_id,
      b.start_date,
      b.end_date,
      b.total_amount,
      b.status,
      b.special_requests,
      b.created_at
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
    ORDER BY b.created_at DESC`,
    [tenantId]
  );

  return result.rows;
}

/**
 * ----------------------------------------------------------------------------
 * 3. Get Booking Requests for an Owner (Owner Dashboard)
 * ----------------------------------------------------------------------------
 * TODO for Member 2:
 * - Fetch all incoming requests for properties owned by this owner
 * - Join with tenant info (full_name, email, phone)
 */
export async function getOwnerBookingRequests(ownerId: string): Promise<BookingRecord[]> {
  const result = await query<BookingRecord>(
    `SELECT 
      b.id,
      b.property_id,
      p.title AS property_title,
      p.city AS property_city,
      b.tenant_id,
      u.full_name AS tenant_name,
      u.email AS tenant_email,
      b.start_date,
      b.end_date,
      b.total_amount,
      b.status,
      b.special_requests,
      b.created_at
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    JOIN users u ON b.tenant_id = u.id
    WHERE p.owner_id = $1
    ORDER BY b.created_at DESC`,
    [ownerId]
  );

  return result.rows;
}

/**
 * ----------------------------------------------------------------------------
 * 4. Update Booking Status (Owner Approval / Rejection Workflow)
 * ----------------------------------------------------------------------------
 * TODO for Member 2:
 * - Validate that the owner owns the property
 * - Update status to 'APPROVED' or 'REJECTED'
 * - Note: DB Trigger 'trg_validate_booking_overlap' will fire on APPROVED!
 */
export async function updateBookingStatus(
  bookingId: string,
  actorId: string,
  actorRole: 'OWNER' | 'TENANT',
  newStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED'
): Promise<{ success: boolean; message: string }> {
  return await withTransaction(async (client) => {
    // Verify the actor is allowed to touch this booking (owner of the property, or the tenant)
    const checkRes = await client.query(
      `SELECT b.id, b.status
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.id = $1
         AND (($3 = 'OWNER' AND p.owner_id = $2) OR ($3 = 'TENANT' AND b.tenant_id = $2))`,
      [bookingId, actorId, actorRole]
    );

    if (checkRes.rows.length === 0) {
      throw new Error('Booking not found or unauthorized');
    }

    await client.query(
      `UPDATE bookings SET status = $1 WHERE id = $2`,
      [newStatus, bookingId]
    );

    return {
      success: true,
      message: `Booking has been marked as ${newStatus}`,
    };
  });
}
