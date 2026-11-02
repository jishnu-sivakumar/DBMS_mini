/**
 * ============================================================================
 * BOOKING & RENTAL MANAGEMENT SERVICE (Member 2)
 * ============================================================================
 *
 * 1. ACID transaction for booking creation.
 * 2. Concurrency control: row-level lock (SELECT ... FOR UPDATE) on the property.
 * 3. State machine: PENDING -> APPROVED | REJECTED | CANCELLED, APPROVED -> CANCELLED
 *    (also enforced in the DB by trg_validate_booking_transition).
 * 4. Overlap protection: fn_check_booking_conflict + trg_validate_booking_overlap.
 *    The trigger's exception text is passed straight back to the UI.
 *
 * All SQL is parameterised.
 */

import { query, withTransaction } from '@/lib/db';

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface BookingRequestInput {
  property_id: string;
  tenant_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
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
  start_date: string;
  end_date: string;
  total_amount: number;
  status: BookingStatus;
  special_requests?: string;
  created_at: string;
  payment_status?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(label: string, value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error(`${label} must be a valid date (YYYY-MM-DD)`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be a valid date (YYYY-MM-DD)`);
  return d;
}

/**
 * 1. Create a rental booking request (transactional, row-locked).
 */
export async function createBookingRequest(
  data: BookingRequestInput
): Promise<{ success: boolean; bookingId?: string; message: string }> {
  const start = parseDate('Start date', data.start_date);
  const end = parseDate('End date', data.end_date);
  if (end <= start) throw new Error('End date must be after the start date');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (start < today) throw new Error('Start date cannot be in the past');

  return await withTransaction(async (client) => {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [data.tenant_id]);

    // Step 1: lock the property row so concurrent requests are serialised
    const propCheck = await client.query(
      `SELECT id, price_per_month, status, owner_id
       FROM properties
       WHERE id = $1
       FOR UPDATE`,
      [data.property_id]
    );

    if (propCheck.rows.length === 0) throw new Error('Property not found');

    const property = propCheck.rows[0];
    if (property.owner_id === data.tenant_id) {
      throw new Error('You cannot book your own property');
    }
    if (property.status !== 'AVAILABLE') {
      throw new Error(`Property is currently ${property.status} and cannot be booked`);
    }

    // Step 2: date conflict check against already APPROVED bookings (stored function)
    const conflictCheck = await client.query(
      `SELECT fn_check_booking_conflict($1, $2::date, $3::date) AS has_conflict`,
      [data.property_id, data.start_date, data.end_date]
    );
    if (conflictCheck.rows[0]?.has_conflict) {
      throw new Error('Property has an overlapping confirmed booking for these dates');
    }

    // Step 3: a tenant may not hold two live requests for overlapping dates on one property
    const dup = await client.query(
      `SELECT 1 FROM bookings
       WHERE property_id = $1 AND tenant_id = $2
         AND status IN ('PENDING', 'APPROVED')
         AND (start_date, end_date) OVERLAPS ($3::date, $4::date)
       LIMIT 1`,
      [data.property_id, data.tenant_id, data.start_date, data.end_date]
    );
    if (dup.rows.length > 0) {
      throw new Error('You already have an active request for these dates on this property');
    }

    // Step 4: total = price_per_month * months (30-day blocks, minimum 1)
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const months = Math.max(1, Math.round(days / 30));
    const totalAmount = Number(property.price_per_month) * months;

    // Step 5: insert as PENDING
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
        data.special_requests?.trim() || null,
      ]
    );

    return {
      success: true,
      bookingId: insertRes.rows[0].id,
      message: 'Booking request created successfully. Awaiting owner approval.',
    };
  });
}

const BOOKING_COLUMNS = `
      b.id,
      b.property_id,
      p.title AS property_title,
      p.city AS property_city,
      b.tenant_id,
      b.start_date::text AS start_date,
      b.end_date::text AS end_date,
      b.total_amount,
      b.status,
      b.special_requests,
      b.created_at`;

/**
 * 2. Bookings of one tenant (tenants only ever see their own rows).
 */
export async function getTenantBookings(tenantId: string): Promise<BookingRecord[]> {
  const result = await query<BookingRecord>(
    `SELECT ${BOOKING_COLUMNS}
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
    ORDER BY b.created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

/**
 * 3. Booking requests for properties owned by one owner.
 */
export async function getOwnerBookingRequests(ownerId: string): Promise<BookingRecord[]> {
  const result = await query<BookingRecord>(
    `SELECT ${BOOKING_COLUMNS},
      u.full_name AS tenant_name,
      u.email AS tenant_email
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
 * Row of view_owner_analytics for one owner (KPI cards on the owner dashboard).
 */
export async function getOwnerAnalyticsFor(ownerId: string) {
  const result = await query(
    `SELECT * FROM view_owner_analytics WHERE owner_id = $1`,
    [ownerId]
  );
  return result.rows[0] ?? null;
}

/**
 * 4. Change a booking's status.
 *    - OWNER  : PENDING -> APPROVED | REJECTED (own properties only)
 *    - TENANT : PENDING | APPROVED -> CANCELLED (own bookings only)
 *    The booking row is locked first. On APPROVED the DB trigger
 *    trg_validate_booking_overlap fires; its exception message is returned as-is.
 */
export async function updateBookingStatus(
  bookingId: string,
  actorId: string,
  actorRole: 'OWNER' | 'TENANT',
  newStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED'
): Promise<{ success: boolean; message: string }> {
  return await withTransaction(async (client) => {
    const checkRes = await client.query(
      `SELECT b.id, b.status
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.id = $1
         AND (($3 = 'OWNER' AND p.owner_id = $2) OR ($3 = 'TENANT' AND b.tenant_id = $2))
       FOR UPDATE OF b`,
      [bookingId, actorId, actorRole]
    );

    if (checkRes.rows.length === 0) {
      throw new Error('Booking not found or unauthorized');
    }

    // Let trg_audit_booking_status record who made the change (transaction-local setting)
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [actorId]);

    const current: BookingStatus = checkRes.rows[0].status;
    if (current === newStatus) {
      throw new Error(`Booking is already ${current}`);
    }

    // The same rules live in trg_validate_booking_transition; checking here gives a friendlier message
    const allowedFrom: Record<string, BookingStatus[]> = {
      APPROVED: ['PENDING'],
      REJECTED: ['PENDING'],
      CANCELLED: ['PENDING', 'APPROVED'],
    };
    if (!allowedFrom[newStatus].includes(current)) {
      throw new Error(`A ${current} booking cannot be changed to ${newStatus}`);
    }

    // May throw "Double booking conflict: ..." from trg_validate_booking_overlap
    await client.query(`UPDATE bookings SET status = $1::booking_status WHERE id = $2`, [
      newStatus,
      bookingId,
    ]);

    return { success: true, message: `Booking has been marked as ${newStatus}` };
  });
}

export type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING';
const METHODS: PaymentMethod[] = ['UPI', 'CARD', 'NET_BANKING'];

/**
 * 5. Pay for an APPROVED booking (tenant only), inside one transaction.
 *    The booking row is locked so two clicks cannot create two payments; the
 *    unique partial index and trg_payment_stamp_and_validate back this up in the DB.
 */
export async function payBooking(
  bookingId: string,
  tenantId: string,
  method: string
): Promise<{ success: boolean; message: string; transactionRef: string }> {
  if (!METHODS.includes(method as PaymentMethod)) {
    throw new Error(`Payment method must be one of: ${METHODS.join(', ')}`);
  }

  return await withTransaction(async (client) => {
    const res = await client.query(
      `SELECT id, status, total_amount
       FROM bookings
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [bookingId, tenantId]
    );
    if (res.rows.length === 0) throw new Error('Booking not found or unauthorized');

    const booking = res.rows[0];
    if (booking.status !== 'APPROVED') {
      throw new Error(`Only APPROVED bookings can be paid (this one is ${booking.status})`);
    }

    const already = await client.query(
      `SELECT 1 FROM payments WHERE booking_id = $1 AND status = 'PAID'`,
      [bookingId]
    );
    if (already.rows.length > 0) throw new Error('This booking has already been paid');

    // paid_at is stamped by trg_payment_stamp_and_validate
    const pay = await client.query(
      `INSERT INTO payments (booking_id, amount, method, status)
       VALUES ($1, $2, $3::payment_method, 'PAID')
       RETURNING transaction_ref`,
      [bookingId, booking.total_amount, method]
    );

    return {
      success: true,
      message: 'Payment successful',
      transactionRef: pay.rows[0].transaction_ref,
    };
  });
}

/**
 * 6. Status history for one booking (visible to its tenant or the property owner).
 */
export async function getBookingHistory(bookingId: string, userId: string, role: 'OWNER' | 'TENANT') {
  const access = await query(
    `SELECT 1
     FROM bookings b JOIN properties p ON p.id = b.property_id
     WHERE b.id = $1 AND (($3 = 'OWNER' AND p.owner_id = $2) OR ($3 = 'TENANT' AND b.tenant_id = $2))`,
    [bookingId, userId, role]
  );
  if (access.rows.length === 0) throw new Error('Booking not found or unauthorized');

  const [audit, payments] = await Promise.all([
    query(
      `SELECT a.old_status, a.new_status, a.changed_at, u.full_name AS changed_by_name
       FROM booking_audit a LEFT JOIN users u ON u.id = a.changed_by
       WHERE a.booking_id = $1 ORDER BY a.id`,
      [bookingId]
    ),
    query(
      `SELECT amount, method, status, transaction_ref, paid_at
       FROM payments WHERE booking_id = $1 ORDER BY created_at`,
      [bookingId]
    ),
  ]);
  return { audit: audit.rows, payments: payments.rows };
}
