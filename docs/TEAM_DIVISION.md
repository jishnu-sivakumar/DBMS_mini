# 👥 PropFind: 2-Member Team Division & Responsibility Matrix

**Course:** DBMS Experiential Learning – Level 3 Mini-Project  
**Project:** PropFind: Semantic Property Search & Rental Management System  
**Paradigms:** Option 2 (SQL + Vector Database via PostgreSQL & pgvector)

---

## 🎯 Project Overview & Scope Division
PropFind was architected specifically for a 2-person engineering team to fulfill the requirements of the DBMS Level 3 Mini-Project without duplicating efforts or leaving either member without core database responsibilities.

```
                              ┌──────────────────────────────────────────────┐
                              │           PropFind Core Database             │
                              │   (PostgreSQL 18 + pgvector 0.8 Extension)   │
                              └──────────────────────┬───────────────────────┘
                                                     │
                 ┌───────────────────────────────────┴───────────────────────────────────┐
                 │                                                                       │
                 ▼                                                                       ▼
    ┌──────────────────────────────┐                                        ┌──────────────────────────────┐
    │       MEMBER 1 SCOPE         │                                        │       MEMBER 2 SCOPE         │
    │  Vector Search & Property    │                                        │  Rental Lifecycle & Booking  │
    │      Catalog Architecture    │                                        │     Concurrency Control      │
    ├──────────────────────────────┤                                        ├──────────────────────────────┤
    │ • Database Schema & DDL      │                                        │ • Rental Booking Workflow    │
    │ • pgvector Cosine Embeddings │                                        │ • Concurrency Control & Locks│
    │ • HNSW Vector Indexing       │                                        │ • Date Conflict Procedure    │
    │ • Semantic Search Engine     │                                        │ • Owner Approval State Mach. │
    │ • Property Creation Pipeline │                                        │ • Tenant Booking Portal      │
    │ • Catalog & Relational Views │                                        │ • Double Booking Prevention  │
    └──────────────────────────────┘                                        └──────────────────────────────┘
```

---

## 📌 Member 1: Vector Search, Property Catalog & Core DB Architecture

### Status: ✅ FULLY IMPLEMENTED & OPERATIONAL

Member 1 was responsible for establishing the database foundations, dual-paradigm architecture (Relational + Vector), seed pipelines, and the semantic discovery engine.

### Key Contributions & Implemented Features:
1. **Core Database Architecture (`db/schema.sql`)**:
   - Designed normalized relational schema (`users`, `properties`, `property_embeddings`, `bookings`, `reviews`).
   - Defined custom ENUM types (`user_role`, `property_status`, `booking_status`).
   - Enforced relational integrity with Primary Keys, Foreign Keys (`ON DELETE CASCADE` / `RESTRICT`), and strict domain `CHECK` constraints.
   - Built the **Hierarchical Navigable Small World (HNSW)** index on vectors for sub-linear similarity search.
   - Built relational B-Tree indexes on search keys (`city`, `price_per_month`, `status`, `owner_id`).
   - Created `view_property_catalog` joining properties, owners, and aggregate tenant ratings.
   - Created `view_owner_analytics` with `GROUP BY` and `HAVING` aggregations.

2. **Vector Embedding Service (`lib/embeddings.ts`)**:
   - Engineered dense 384-dimensional vector projection matching standard `all-MiniLM-L6-v2`.
   - Built cosine-distance normalized embedding engine that runs 100% offline without requiring paid third-party API keys, plus optional OpenAI compatibility.
   - Formatted rich property context strings for vector indexing.

3. **Semantic Search & Catalog Engine (`lib/services/property-service.ts`)**:
   - Implemented `searchPropertiesSemantic()` calling stored function `fn_search_properties_semantic` using pgvector's `<=>` cosine distance operator.
   - Integrated hybrid search combining natural language semantic similarity scores with SQL relational filters (City, Bedrooms, Maximum Budget).
   - Created listing insertion pipeline that generates vectors and stores them in `property_embeddings` inside an ACID transaction.

4. **Frontend Discovery UI (`app/page.tsx` & `app/properties/new/page.tsx`)**:
   - Built the Flagship Search interface with natural language prompt suggestions.
   - Property cards featuring dynamic **% Semantic Match** badges.
   - Interactive property inspection modal with stats.
   - Listing creation form with real-time vectorization feedback.

---

## 📌 Member 2: Authentication, Rental Lifecycle, Payments & SQL Test Suite

### Status: ✅ IMPLEMENTED & TESTED

Member 2 owns everything that happens after a tenant finds a listing: who is allowed to do what, how a booking moves from request to payment, and how the database proves it stays consistent. The work was delivered as pull requests from separate branches (`feature/auth`, `feature/booking-lifecycle`, `feature/payments-audit`, `feature/real-embeddings`, `feature/sql-demos`, `docs/member2`).

### Deliverables
1. **Authentication & roles** (`lib/jwt.ts`, `lib/auth.ts`, `middleware.ts`, `app/api/auth/*`, `app/login`, `app/register`, `components/Navbar.tsx`)
   - bcrypt password hashes, JWT (jose) in an httpOnly cookie, roles `OWNER` / `TENANT` / `ADMIN`.
   - Middleware protects `/dashboard/owner`, `/dashboard/tenant`, `/properties/new`; every API route re-checks the role.
   - The old "pick the first owner/tenant" demo fallbacks were removed; the session user is always used.
   - Demo users are seeded with bcrypt hashes; DB `CHECK` constraints validate email and phone.
2. **Booking lifecycle** (`lib/services/booking-service.ts`, `app/api/bookings/**`)
   - Date validation, property row lock (`SELECT ... FOR UPDATE`), `fn_check_booking_conflict`, duplicate-request guard.
   - Owner approve / reject, tenant cancel; the booking row is locked during status changes.
   - `trg_validate_booking_transition` enforces the state machine in the database itself; `trg_validate_booking_overlap` rejects overlapping approvals and its message is displayed in the Owner Portal.
3. **Dashboards** (`app/dashboard/owner`, `app/dashboard/tenant`)
   - Owner: All / Pending / Approved / Rejected tabs, KPI cards from `view_owner_analytics`, payment column.
   - Tenant: sees only their own bookings; Cancel, Pay (UPI / Card / Net banking) and History actions.
4. **Payments & audit** (`db/schema.sql`, `payBooking()`, `/api/bookings/[id]/pay`)
   - `payments` table (FK to bookings, `amount CHECK > 0`, method, status, `paid_at`), partial unique index (one `PAID` payment per booking).
   - Triggers: stamp `paid_at` and validate; audit every booking status change into `booking_audit`; auto-refund on cancel.
5. **Real embeddings** (`lib/embeddings.ts`, `next.config.mjs`, `scripts/seed.mjs`)
   - Keyword-hash vectorizer replaced by real `all-MiniLM-L6-v2` (mean pooling, normalised, 384 dims); optional OpenAI path kept.
   - Listing text now puts amenities before the description, so *"house where I can keep my dog"* returns the pet-friendly villa first.
6. **Dataset & smarter search** (`scripts/seed-data.mjs`, `lib/query-parser.ts`)
   - 58 listings in 15 cities across the whole price range, plus extra users, reviews, and bookings in every status.
   - Budget, bedrooms and city written inside the search sentence are parsed into exact SQL filters (vector similarity is poor at numbers); the UI shows what was understood.
7. **SQL for the report** (`db/queries.sql`, `db/transactions_tests.sql`)
   - 30+ labelled queries and a transaction / negative test script (23 checks, all PASS).

---

## 📊 DBMS Level 3 Requirements Fulfillment Matrix

| Requirement | Member 1 Responsibility | Member 2 Responsibility |
| :--- | :--- | :--- |
| **SQL Database (PostgreSQL)** | Schema design, DDL tables, types, B-Tree indexes | Booking relational workflows & tenant relationships |
| **Vector Database (`pgvector`)** | 384-dim vector embeddings, HNSW index, cosine similarity | Consumes catalog listings for booking requests |
| **Advanced Feature 1: Vectors** | pgvector cosine similarity search (`<=>`) | - |
| **Advanced Feature 2: Transactions** | Property creation + embedding insertion transaction | Concurrency-controlled booking transaction (`FOR UPDATE`), atomic payment, COMMIT / ROLLBACK / SAVEPOINT demos |
| **Advanced Feature 3: Stored Procedures**| `fn_search_properties_semantic` | `fn_check_booking_conflict` |
| **Advanced Feature 4: Triggers** | `trg_properties_timestamp` auto-updated timestamp | `trg_validate_booking_overlap`, `trg_validate_booking_transition`, `trg_payment_stamp_and_validate`, `trg_audit_booking_status`, `trg_refund_on_cancel` |
| **Advanced Feature 5: Views** | `view_property_catalog`, `view_owner_analytics` | Consumes views inside Owner Portal |
| **Web Interface (Next.js)** | Search bar, Hybrid Filters, Listing form, Cards | Login / register, Owner Dashboard, Tenant dashboard (cancel, pay, history) |
| **Authentication (2+ roles)** | - | bcrypt + JWT cookie, `OWNER` / `TENANT` / `ADMIN`, middleware + per-route role checks |
| **Constraints & testing** | Core CHECK / FK constraints | `users` CHECKs, `payments` constraints, 22 negative tests in `db/transactions_tests.sql` |
