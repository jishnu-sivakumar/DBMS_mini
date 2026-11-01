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

## 📌 Member 2: Rental Lifecycle, Booking Concurrency & Owner Dashboard

### Status: 🛠️ BOILERPLATE & STUBS PREPARED (Ready for Teammate)

Member 2 is responsible for the transactional and concurrency-critical aspects of the rental platform: managing booking lifecycles, preventing race conditions, and owner approvals.

### Deliverables & Boilerplates Prepared for Member 2:
1. **Concurrency Service Boilerplate (`lib/services/booking-service.ts`)**:
   - Prepared transaction logic with row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions during simultaneous bookings.
   - Pre-integrated call to stored procedure `fn_check_booking_conflict(p_property_id, p_start_date, p_end_date)`.
   - Stubs for `getTenantBookings()` and `getOwnerBookingRequests()`.
   - Booking state machine stub `updateBookingStatus(id, status, ownerId)`.

2. **Database Trigger Integration (`db/schema.sql`)**:
   - Provided trigger `trg_validate_booking_overlap` executing `fn_trg_prevent_double_booking()` before `INSERT` or `UPDATE` on `bookings` to ensure database-level consistency.

3. **Owner Management Dashboard (`app/dashboard/owner/page.tsx`)**:
   - Functional UI layout displaying owner analytics metrics from `view_owner_analytics`.
   - Incoming booking requests table with working "Approve" and "Reject" buttons.
   - Dedicated checklist card highlighting Member 2's specific testing tasks.

4. **Tenant Dashboard (`app/dashboard/tenant/page.tsx`)**:
   - Tenant booking history UI displaying request status (`PENDING`, `APPROVED`, `REJECTED`).

5. **API Route Handlers (`app/api/bookings/route.ts` & `app/api/bookings/[id]/route.ts`)**:
   - Working endpoints accepting booking requests and updating statuses.

---

## 📊 DBMS Level 3 Requirements Fulfillment Matrix

| Requirement | Member 1 Responsibility | Member 2 Responsibility |
| :--- | :--- | :--- |
| **SQL Database (PostgreSQL)** | Schema design, DDL tables, types, B-Tree indexes | Booking relational workflows & tenant relationships |
| **Vector Database (`pgvector`)** | 384-dim vector embeddings, HNSW index, cosine similarity | Consumes catalog listings for booking requests |
| **Advanced Feature 1: Vectors** | pgvector cosine similarity search (`<=>`) | - |
| **Advanced Feature 2: Transactions** | Property creation + embedding insertion transaction | Concurrency-controlled booking transaction (`FOR UPDATE`) |
| **Advanced Feature 3: Stored Procedures**| `fn_search_properties_semantic` | `fn_check_booking_conflict` |
| **Advanced Feature 4: Triggers** | `trg_properties_timestamp` auto-updated timestamp | `trg_validate_booking_overlap` double booking guard |
| **Advanced Feature 5: Views** | `view_property_catalog`, `view_owner_analytics` | Consumes views inside Owner Portal |
| **Web Interface (Next.js)** | Search bar, Hybrid Filters, Listing form, Cards | Owner Dashboard, Tenant Bookings page |
