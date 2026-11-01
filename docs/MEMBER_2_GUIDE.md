# 🤝 Member 2 Developer Guide: Booking & Rental Lifecycle Implementation

**Welcome Member 2!**  
Member 1 has laid down the foundational database architecture, DDL schemas, `pgvector` semantic search engine, and seed pipelines. Your primary role focuses on **Rental Management, Concurrency Control, ACID Transactions, and the Owner/Tenant Workflow**.

Below is your complete roadmap, code locations, and instructions to complete and demo your module.

---

## 📂 Your Key Files & Directories

| File Path | Status | Your Task |
| :--- | :--- | :--- |
| `lib/services/booking-service.ts` | 🛠️ Saffolded with Blueprint | Contains transaction boilerplate and conflict checks. Review and test edge cases. |
| `app/api/bookings/route.ts` | 🛠️ Working Boilerplate | Handles `GET` (fetch bookings) and `POST` (create booking). |
| `app/api/bookings/[id]/route.ts` | 🛠️ Working Boilerplate | Handles `PATCH` (owner approves or rejects booking). |
| `app/dashboard/owner/page.tsx` | 🛠️ Working UI Scaffold | Owner portal to review and approve/reject bookings with analytics. |
| `app/dashboard/tenant/page.tsx`| 🛠️ Working UI Scaffold | Tenant page showing submitted booking requests and approval status. |

---

## 🚀 Step-by-Step Instructions for Member 2

### Step 1: Understand the Concurrency Flow
When multiple tenants attempt to book the same property for overlapping dates, a naive database application will suffer from a **race condition** (double booking).

In `lib/services/booking-service.ts`, we implement a strict 4-stage transaction:
1. **Acquire Row Lock (`SELECT ... FOR UPDATE`)**:
   ```sql
   SELECT id, price_per_month, status 
   FROM properties 
   WHERE id = $1 
   FOR UPDATE;
   ```
   *Why:* This ensures concurrent incoming requests wait until the current transaction finishes.
2. **Execute Conflict Check Procedure**:
   ```sql
   SELECT fn_check_booking_conflict($1, $2::date, $3::date) AS has_conflict;
   ```
3. **Calculate Total Rental Amount**:
   Computes duration and multiplies by `price_per_month`.
4. **Insert Booking Record**:
   Inserts row with initial status `'PENDING'`.

---

### Step 2: Test the Database Trigger (`trg_validate_booking_overlap`)
Member 1 has already installed the trigger in PostgreSQL:
```sql
CREATE TRIGGER trg_validate_booking_overlap
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_trg_prevent_double_booking();
```

**How to verify:**
1. Open the PropFind application (`http://localhost:3000`).
2. Submit a booking for Property 1 from `2026-11-15` to `2026-12-15`.
3. Open the **Owner Portal** (`/dashboard/owner`) and click **Approve**. (Status becomes `APPROVED`).
4. Now submit a second booking for Property 1 with overlapping dates (e.g., `2026-12-01` to `2027-01-01`).
5. In the Owner Portal, attempt to **Approve** the second booking.
6. **Expected Result:** The PostgreSQL trigger intercepts the update and raises an exception:
   `"Double booking conflict: Property ... is already booked for date range ..."`!
   This proves database-level data integrity without relying solely on application code.

---

### Step 3: Polish the Owner & Tenant Dashboards
1. Open `app/dashboard/owner/page.tsx`:
   - Verify that properties, pending requests, and confirmed bookings reflect accurate counts.
   - You can add filtering tabs: "All", "Pending", "Approved", "Rejected".
2. Open `app/dashboard/tenant/page.tsx`:
   - Connect user authentication session or tenant selector so tenants only view their own leases.

---

## 🔮 Future Enhancements You Can Add
If you wish to add extra features to score maximum bonus marks:
1. **Payment / Security Deposit Receipt Table**:
   - Add a `payments` table with `booking_id`, `amount`, `payment_method` (UPI/Card), `transaction_id`, `status` (`PAID`).
   - Create a trigger that auto-confirms a booking upon payment insertion.
2. **Lease Extension Feature**:
   - Allow tenants to submit lease extension requests with automatic date conflict checking.
3. **Interactive Calendar UI**:
   - Display a visual availability calendar (e.g. green for available days, red for booked days) on the property modal.

---

## 🎤 Talking Points for Project Evaluation (Your Demo Pitch)

When presenting your portion to the professor/evaluator:
1. **Highlight the Concurrency Problem**: Explain why simple CRUD fails for reservations (race conditions between concurrent requests).
2. **Demonstrate Row Locking**: Show how `SELECT ... FOR UPDATE` prevents two transactions from reading stale availability data simultaneously.
3. **Demonstrate the Stored Procedure & Trigger**: Point to `fn_check_booking_conflict` and `trg_validate_booking_overlap` in `db/schema.sql`. Show the trigger throwing an error when an overlapping booking is approved.
4. **Demonstrate Relational Aggregation**: Explain how the Owner Portal queries `view_owner_analytics` using `GROUP BY` and aggregate functions (`SUM`, `AVG`, `COUNT DISTINCT`) to show real-time business metrics.
