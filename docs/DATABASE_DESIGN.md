# 🗄️ PropFind: Database Design & Advanced Features Specification

**Course:** DBMS Experiential Learning – Level 3 Mini-Project  
**Database Engine:** PostgreSQL 18.6 with `pgvector` 0.8.7  
**Schema File:** `db/schema.sql`  
**Seed Script:** `scripts/seed.mjs`

---

## 1. Relational Schema & Data Dictionary

### Table: `users`
Stores authenticated users belonging to two required roles: Property Owners and Tenants.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique user identifier |
| `full_name` | `VARCHAR(120)` | `NOT NULL` | User's full name |
| `email` | `VARCHAR(160)` | `NOT NULL UNIQUE` | Login email address |
| `password_hash`| `VARCHAR(255)` | `NOT NULL` | Hashed credential (bcrypt) |
| `role` | `user_role` | `NOT NULL DEFAULT 'TENANT'` | Enum: `'OWNER'`, `'TENANT'`, `'ADMIN'` |
| `phone` | `VARCHAR(20)` | `NULL` | Contact telephone number |
| `avatar_url` | `TEXT` | `NULL` | Profile photo URL |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

---

### Table: `properties`
Stores structured rental property metadata and specs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique property ID |
| `owner_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Property owner FK |
| `title` | `VARCHAR(200)` | `NOT NULL` | Listing headline |
| `description` | `TEXT` | `NOT NULL` | Detailed natural language description |
| `property_type`| `VARCHAR(50)` | `NOT NULL DEFAULT 'Apartment'` | Apartment, Villa, Penthouse, Studio |
| `price_per_month`| `NUMERIC(10,2)`| `NOT NULL CHECK (price_per_month > 0)` | Monthly rental fee in INR |
| `security_deposit`|`NUMERIC(10,2)`| `NOT NULL DEFAULT 0 CHECK (>= 0)` | Refundable security deposit |
| `bedrooms` | `INT` | `NOT NULL CHECK (bedrooms >= 0)` | Number of bedrooms (BHK) |
| `bathrooms`| `INT` | `NOT NULL CHECK (bathrooms >= 0)` | Number of bathrooms |
| `area_sqft`| `INT` | `NOT NULL CHECK (area_sqft > 0)` | Carpet area in sq. ft. |
| `address` | `TEXT` | `NOT NULL` | Physical street address |
| `city` | `VARCHAR(80)` | `NOT NULL` | City (Bengaluru, Mumbai, Pune, etc.) |
| `state` | `VARCHAR(80)` | `NOT NULL` | State (Karnataka, Maharashtra, etc.) |
| `pincode` | `VARCHAR(20)` | `NOT NULL` | Postal code |
| `status` | `property_status`| `NOT NULL DEFAULT 'AVAILABLE'` | Enum: `'AVAILABLE'`, `'RENTED'`, `'MAINTENANCE'` |
| `amenities`| `TEXT[]` | `DEFAULT '{}'` | Array of amenities (Balcony, Gym, etc.) |
| `image_url`| `TEXT` | `NULL` | Cover photo URL |
| `created_at`| `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Listing creation date |
| `updated_at`| `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

---

### Table: `property_embeddings` (Vector Database Paradigm)
Stores dense 384-dimensional mathematical embeddings derived from listing text for pgvector cosine distance search.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `property_id` | `UUID` | `PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE` | 1-to-1 link to property |
| `embedding` | `vector(384)` | `NOT NULL` | Dense float vector representing semantic context |
| `model_name` | `VARCHAR(100)`| `NOT NULL DEFAULT 'all-MiniLM-L6-v2'` | Embedding generator identifier |
| `indexed_content`| `TEXT` | `NOT NULL` | Snapshot of text used to create embedding |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Embedding generation date |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Embedding update date |

---

### Table: `bookings`
Tracks tenant rental requests, dates, concurrency locks, and approval states.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique booking ID |
| `property_id` | `UUID` | `NOT NULL REFERENCES properties(id) ON DELETE RESTRICT` | Reserved property |
| `tenant_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Booking tenant FK |
| `start_date` | `DATE` | `NOT NULL` | Lease start date |
| `end_date` | `DATE` | `NOT NULL` | Lease end date (`end_date > start_date`) |
| `total_amount` | `NUMERIC(10,2)`| `NOT NULL CHECK (total_amount >= 0)` | Calculated total rent |
| `status` | `booking_status`| `NOT NULL DEFAULT 'PENDING'` | Enum: `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'` |
| `special_requests`| `TEXT` | `NULL` | Tenant move-in instructions |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Request timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Status change timestamp |

---

### Table: `reviews`
Stores tenant ratings and textual feedback for properties.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique review ID |
| `property_id` | `UUID` | `NOT NULL REFERENCES properties(id) ON DELETE CASCADE` | Rated property FK |
| `tenant_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Reviewing tenant FK |
| `rating` | `INT` | `NOT NULL CHECK (rating BETWEEN 1 AND 5)` | Star rating 1 to 5 |
| `comment` | `TEXT` | `NULL` | Detailed review |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Review submission timestamp |
| *Constraint* | `UNIQUE(property_id, tenant_id)` | One review per tenant per property |

---

## 2. Advanced Database Features Implementation

The project demonstrates **six (6)** advanced database concepts, exceeding the minimum 4 required by the syllabus:

### Feature 1: Vector Similarity Search (`pgvector`)
- **Index**: Hierarchical Navigable Small World (**HNSW**):
  ```sql
  CREATE INDEX idx_property_embeddings_hnsw 
  ON property_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```
- **Similarity Computation**: Stored function `fn_search_properties_semantic` executes cosine distance:
  $$\text{Similarity Score} = 1 - (\text{embedding} \Leftrightarrow \text{query\_vector})$$

### Feature 2: Stored Procedures & Functions
1. `fn_search_properties_semantic(query_vector, threshold, limit, city, max_price, bedrooms)`:
   Retrieves listings ordered by semantic proximity while applying relational filters in a single execution plan.
2. `fn_check_booking_conflict(property_id, start_date, end_date, exclude_id)`:
   Evaluates SQL temporal interval overlap `(start_date, end_date) OVERLAPS (p_start_date, p_end_date)` against existing `'APPROVED'` bookings.
3. `fn_update_timestamp()`:
   Procedural trigger function keeping `updated_at` timestamps current.

### Feature 3: Database Triggers
1. **Double Booking Guard (`trg_validate_booking_overlap`)**:
   Fires `BEFORE INSERT OR UPDATE` on `bookings`. If a booking is being marked as `'APPROVED'`, it triggers an exception if a date conflict exists, guaranteeing serial integrity at the database engine level.
2. **Audit Timestamp Triggers (`trg_properties_timestamp`, `trg_bookings_timestamp`)**:
   Fires `BEFORE UPDATE` to maintain reliable update records.

### Feature 4: Relational & Aggregated Views
1. **`view_property_catalog`**:
   Combines `properties`, `users` (owners), and aggregate ratings from `reviews` via `LEFT JOIN` and `ROUND(AVG(rating), 1)`.
2. **`view_owner_analytics`**:
   Aggregates total properties, occupancy count, average monthly rent, booking requests, and confirmed revenue grouped by owner (`GROUP BY u.id HAVING COUNT(p.id) >= 0`).

### Feature 5: ACID Transactions & Concurrency Control
- Demonstrated in `lib/services/property-service.ts` (property + vector creation) and `lib/services/booking-service.ts` (row locking `SELECT ... FOR UPDATE` before booking insertion).

### Feature 6: B-Tree & Multi-Column Indexing
- Indexes on foreign keys (`idx_properties_owner_id`, `idx_bookings_tenant`), filter columns (`idx_properties_city`, `idx_properties_price`, `idx_properties_status`), and composite date intervals (`idx_bookings_dates`).
