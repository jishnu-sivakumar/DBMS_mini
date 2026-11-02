# 📋 PropFind: Engineering & Development Logs

**Date:** November 1, 2026  
**Project:** PropFind: Semantic Property Search & Rental Management System  
**Environment:** Arch Linux, PostgreSQL 18.6, pgvector 0.8.7, Node.js v26.12.1, Next.js 14.2.35

---

## 🛠️ Phase 1: Database Setup & Extension Verification
- **Log Entry 10:05 AM**: Checked system status.
  - OS: Arch Linux (`x86_64`).
  - Active PostgreSQL service detected on socket `/run/postgresql/.s.PGSQL.5432`.
- **Log Entry 10:07 AM**: Installed and validated `vector` extension version `0.8.7`.
- **Log Entry 10:08 AM**: Created dedicated project database `propfind_db`.
  ```sql
  CREATE DATABASE propfind_db;
  \c propfind_db
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

---

## 🛠️ Phase 2: Schema Design & Execution (`db/schema.sql`)
- **Log Entry 10:15 AM**: Drafted relational schema with 5 primary tables:
  - `users` (Owners, Tenants, Admin)
  - `properties` (Listing specs, prices, location, amenities)
  - `property_embeddings` (Vector table with 384 dimensions for cosine indexing)
  - `bookings` (Lease dates, statuses, concurrency controls)
  - `reviews` (Tenant feedback, ratings 1 to 5)
- **Log Entry 10:18 AM**: Implemented Advanced Database Features:
  - **HNSW Index**:
    `CREATE INDEX idx_property_embeddings_hnsw ON property_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
  - **Relational View (`view_property_catalog`)**:
    Computed average ratings using `AVG(r.rating)::numeric` with `LEFT JOIN` and `GROUP BY`.
  - **Analytics View (`view_owner_analytics`)**:
    Computed property counts, average rent, booking requests, and confirmed revenue using `GROUP BY u.id HAVING COUNT(p.id) >= 0`.
  - **Stored Procedure (`fn_search_properties_semantic`)**:
    Unified vector cosine distance (`<=>`) retrieval with hybrid relational filters (City, Bedrooms, Max Budget).
  - **Trigger (`trg_validate_booking_overlap`)**:
    Automated double-booking prevention firing `BEFORE INSERT OR UPDATE` on `bookings`.
- **Log Entry 10:20 AM**: Executed `psql "postgresql://postgres@localhost:5432/propfind_db" -f db/schema.sql`.
  - Result: All tables, views, procedures, and triggers created with exit code `0`.

---

## 🛠️ Phase 3: Seed Pipeline & Vector Verification
- **Log Entry 10:25 AM**: Developed deterministic 384-dimensional semantic embedding service (`lib/embeddings.ts`).
  - Implemented unit-norm vector projection ($L_2 = 1.0$).
  - Added real-estate domain semantic clusters (quiet, tech park, luxury, pool, budget, metro, pet friendly, etc.).
- **Log Entry 10:30 AM**: Executed `scripts/seed.mjs`.
  - Seeded 3 Owners (Priya Sharma, Rahul Verma, Ananya Roy).
  - Seeded 2 Tenants (Rohan Nair, Sneha Patel).
  - Seeded 6 properties across Bengaluru, Mumbai, Pune, and Hyderabad.
  - Generated and stored 6 vector embeddings in `property_embeddings`.
  - Seeded initial tenant reviews and sample booking requests.
- **Log Entry 10:33 AM**: Tested vector similarity queries via PostgreSQL engine:
  - **Query A**: `"quiet 2BHK near tech park pet friendly"`
    ```
    Rank 1: Serene 2BHK near Manyata Tech Park with Balcony (Bengaluru) - 68.1% Match
    Rank 2: Spacious 3BHK Independent Villa with Private Garden (Pune) - 37.3% Match
    Rank 3: Modern Fully-Furnished Studio Apartment (Hyderabad) - 36.1% Match
    ```
  - **Query B**: `"luxury penthouse with swimming pool"`
    ```
    Rank 1: Ultra Luxury 3BHK Penthouse with Private Terrace & Pool Access (Mumbai) - 79.2% Match
    ```
  - Cosine distance ranking matched semantic intent with high precision.

---

## 🛠️ Phase 4: Full-Stack Next.js Application Architecture
- **Log Entry 10:38 AM**: Initialized Next.js 14 App Router with Tailwind CSS & Lucide icons.
- **Log Entry 10:45 AM**: Implemented Member 1's working modules:
  - `lib/services/property-service.ts`: Vector search and property creation pipeline.
  - `app/api/search/route.ts`: Natural language search endpoint.
  - `app/api/properties/route.ts`: Listing creation & catalog retrieval.
  - `app/page.tsx`: Dynamic search interface with prompt chips, hybrid SQL filter toolbar, and property cards with similarity badges.
  - `app/properties/new/page.tsx`: New listing form with automated vectorization.
- **Log Entry 10:52 AM**: Scaffolded Member 2's modules (Teammate Scope):
  - `lib/services/booking-service.ts`: ACID transaction structure with `SELECT ... FOR UPDATE` row locks.
  - `app/api/bookings/route.ts` & `app/api/bookings/[id]/route.ts`: Booking endpoints.
  - `app/dashboard/owner/page.tsx`: Owner portal with analytics and approval actions.
  - `app/dashboard/tenant/page.tsx`: Tenant booking history.
- **Log Entry 11:14 AM**: Executed production build (`npm run build`).
  - Next.js successfully compiled all static and dynamic routes (7/7 pages generated) with zero errors.

---

---

## 🛠️ Phase 5: Team Handoff (Member 1)
- **Member 1** finished the database core, pgvector pipelines, seed generation, and the search frontend.
- **Member 2** received boilerplates for the booking service and dashboards; Phases 6 to 11 below record that work.

---

# Member 2 Logs

**Date:** November 2, 2026
**Environment:** Windows 11, Docker (`pgvector/pgvector:pg16`, DB on port 5433 because 5432 was taken), Node.js v24, Next.js 14.2.35

## 🛠️ Phase 6: Authentication (`feature/auth`, PR #1)
- Moved DB and JWT configuration to environment variables; `.env` is git-ignored; `docker-compose.yml` reads credentials from env.
- Added `lib/jwt.ts` (jose, edge-safe) and `lib/auth.ts` (`getSession`, `requireRole`); the session cookie is httpOnly, SameSite=Lax.
- Added `/api/auth/register|login|logout|me`, `middleware.ts`, login and register pages, and a role-aware navbar.
- Removed the "first owner / first tenant" fallbacks from `/api/bookings` and `/api/properties`.
- Seed now inserts 6 users (3 owners, 2 tenants, 1 admin) with bcrypt hashes. Added `users_email_format` and `users_phone_format` CHECK constraints.
- **Verified with curl:** unauthenticated dashboard -> 307 to `/login`; unauthenticated API -> 401; wrong password -> 401; tenant on `/dashboard/owner` -> redirect; tenant `POST /api/properties` -> 403; duplicate email -> 400; self-registering as ADMIN -> 400.
- **Debugging note:** a stale `next start` process kept serving old code on the same port, which made new checks look broken. Confirm the new server actually started (look for `EADDRINUSE` in its log) before judging test results.

## 🛠️ Phase 7: Booking lifecycle (`feature/booking-lifecycle`, PR #2)
- `createBookingRequest`: validates dates (not in the past, end after start), locks the property with `FOR UPDATE`, calls `fn_check_booking_conflict`, rejects duplicate live requests by the same tenant.
- `updateBookingStatus`: locks the booking row, checks ownership, then updates. Added `trg_validate_booking_transition` so the state machine also holds for direct SQL.
- Owner dashboard tabs (All / Pending / Approved / Rejected); the tenant sees only their rows and can cancel.
- **Verified:** two overlapping PENDING requests; approving the first works; approving the second returns `Double booking conflict: Property ... is already booked for date range ...` from `trg_validate_booking_overlap`, displayed in the UI. Wrong owner and other tenants get "not found or unauthorized"; cancelling twice is refused; direct SQL `APPROVED -> REJECTED` is blocked by the new trigger.

## 🛠️ Phase 8: Payments and audit (`feature/payments-audit`, PR #3)
- Added `payments` (amount `CHECK > 0`, `paid_at`, unique transaction ref) and `booking_audit`.
- Triggers: `trg_payment_stamp_and_validate`, `trg_audit_booking_status` (records the acting user through a transaction-local `app.user_id` setting), `trg_refund_on_cancel`.
- `payBooking()` runs in a transaction with a row lock. `db/schema.sql` was run twice in a row to confirm it is re-runnable.
- **Verified:** pay before approval refused; other tenant and owner cannot pay; invalid method refused; pay once succeeds; second pay refused; cancel refunds the payment; history lists actors.
- **Bug found while testing:** `payment_status` was missing from the booking list because a multi-line text patch silently did not match (CRLF line endings). Fixed in the same PR.

## 🛠️ Phase 9: Real embeddings (`feature/real-embeddings`, PR #4)
- Replaced the keyword-hash vectorizer with `all-MiniLM-L6-v2` through `@huggingface/transformers` (mean pooling, normalised). `next.config.mjs` externalises the ONNX runtime. The seed script imports the same module so stored and query vectors always match.
- First result for *"house where I can keep my dog"* was the wrong listing (family home 29.9% vs villa 27.5%). Compared four ways of building the indexed text; putting amenities directly after the title fixed it without hurting the other queries (villa 35.2% first, family home 32.6% second).
- Spot checks after re-seeding: *quiet place near tech park with balcony* -> Serene 2BHK (56.5%); *cheap flat for a student near metro* -> Budget 1BHK; *luxury penthouse with swimming pool* -> Penthouse (66.1%); *fully furnished studio for software engineer* -> Hitec City studio.
- **Known limitation:** *"apartment that allows pets"* ranks a non-pet studio above the pet-friendly listings; the model is small and the seed set only has 6 listings.

## 🛠️ Phase 10: SQL demos and tests (`feature/sql-demos`, PR #5)
- `db/queries.sql`: joins, GROUP BY / HAVING, nested and correlated subqueries, window function, CTE, UNION, UPDATE / DELETE inside `BEGIN ... ROLLBACK`, views, stored functions, pgvector similarity, full-text search. Runs with `ON_ERROR_STOP` and is repeatable.
- `db/transactions_tests.sql`: COMMIT, ROLLBACK, SAVEPOINT, atomicity, `FOR UPDATE`, audit / payment / refund triggers, and 22 negative tests with a PASS/FAIL summary.
- First run reported 2 failures, both wrong expectations in the tests (the payment trigger fires before the FK check; `ON DELETE RESTRICT` reports SQLSTATE 23503). Tests were corrected; final result 23/23 PASS on two consecutive runs with no leftover rows.

## 🛠️ Phase 11: Documentation (`docs/member2`)
- Updated `README.md` (setup, env vars, demo accounts, full-flow walkthrough, SQL demo commands), `docs/TEAM_DIVISION.md`, and this log.

## 🛠️ Phase 12: Bigger dataset and number-aware search (`feature/more-data`)
- **Problem seen in the UI:** searching "homes under rent 20k" returned only 5 homes and none under 20k. Two causes: the seed had only 6 listings (none cheap), and "under 20k" inside the sentence was only used for vector similarity, which cannot compare numbers (a 20k and a 50k query embed almost identically).
- **Data:** `scripts/seed-data.mjs` now holds 58 listings in 15 cities (hostel beds and PGs from Rs 4,500 up to a Rs 2,50,000 penthouse; 23 under Rs 20,000), 6 owners, 6 tenants, 44 reviews, 14 bookings in every status. Bookings are inserted as PENDING and moved through the real state machine so the audit trigger logs them; paid ones go through the payment trigger. Photos are Unsplash images; every photo ID was checked to return HTTP 200 and all 58 are distinct. (Google Images was not used: it has no public API and scraping it breaks its terms.)
- **Search:** `lib/query-parser.ts` extracts budget (under/below/above/"20k"/"1 lakh"/"15,000"), bedrooms ("2BHK", "3 bedroom") and city from the sentence and applies them as exact SQL filters; only the descriptive remainder is embedded. If nothing descriptive remains, the catalog is returned cheapest first. UI filters still take precedence. 12 parser tests pass (`npm run test:parser`).
- **Bugs found while testing the parser:** `lakh` was being read as `l` and left "akh" behind; plain numbers like `10000` were truncated to `100`. Both fixed.
- **UI:** city dropdown now comes from the database (it was hard-coded to 4 cities), wider bedroom and budget options, and "Understood from your search" chips.
- **Result for the original complaint:** "homes under rent 20k" now returns 23 listings, all at or below Rs 19,500. "pet friendly 2BHK in Pune under 25k" returns the Pune 2BHKs at or below Rs 25,000. The SQL demos still pass (`queries.sql` exit 0, `transactions_tests.sql` 23/23); one query needed a more specific title pattern because a second "Budget 1BHK" listing now exists.

## 🛠️ Phase 13: Owner pages, embedding safety, hosted DB, report (`feature/owner-dashboard-details`, `fix/embedding-fallback-safety`, `feature/hosted-db-support`, `feature/project-report`)
- **Owner Portal:** the four KPI cards now link to detail pages (My Properties, Pending Requests, Confirmed Bookings, Confirmed Revenue) backed by `GET /api/owner/properties`; publishing a listing now lands on My Properties. Tested as owner, tenant and anonymous user (pages 200 / redirect / redirect; API 200 / 403 / 401).
- **Embedding fallback (Member 1's commit `fda1984`):** the offline hash fallback gave up on the real model after 2 seconds and then silently used incompatible vectors for the rest of the process. Kept the fallback and the `postinstall` fix; added `EMBEDDING_LOAD_TIMEOUT_MS` (default 60 s) and made the seed abort and roll back instead of storing fallback vectors (tested with a 1 ms timeout: seed refused, data untouched).
- **Hosted database:** added `DATABASE_SSL`, `npm run db:setup` and `docs/HOSTED_DATABASE.md` (Supabase / Neon). Verified the default local path is unchanged and that the TLS path is active (a non-TLS server is refused). Not tested against a real hosted project (needs an account).
- **Mistake and lesson:** while testing the default path I ran `npm run db:init` against the real local database, which drops and recreates every table, and wiped the hand-made test data. The demo data was restored with `npm run db:seed`; only a test listing and a test account were lost. `db:init` is now called out in the hosted-database guide, and test runs of destructive scripts should use a throwaway database.
- **Report:** `docs/report/PropFind_Project_Report.pdf` / `.docx` with 46 figures (ER diagram, terminal output of the real SQL, code screenshots, application screenshots taken from the running app), data dictionary generated from `information_schema`, and a rubric table with honest Partial / Not done entries. Added ALTER TABLE / DROP / CREATE VIEW demonstrations to `db/queries.sql` because the brief lists ALTER and DROP and the SQL files only showed CREATE. Removed leftover scaffold labels ("Member 2 Module", "Teammate Feature") from the booking modal.
- **Tooling note:** the first PDF contained only 8 of 46 images because Chrome blocks `file://` images on a page loaded from memory; loading the HTML from disk fixed it, and the build now checks for broken images.

## 🛠️ Phase 14: Report moved to the PES University template (`feature/report-pes-format`)
- The course supplied a sample report (`DBMS MINI PROJECT REPORT SAMPLE.docx`). The earlier report had the right content but a different structure, so it was rebuilt **inside the teacher's own template file** so the cover, certificate, declaration, fonts and margins are exactly the teacher's. Work was done by filling the template (names, SRNs, title, abstract, acknowledgement in the first person plural, contents and lists of tables and figures) and replacing the placeholder chapters with ours: 1 Introduction, 2 Problem Definition, 3 ER Model, 4 ER to Relational Mapping (steps of the algorithm and relational schema diagram), 5 DDL, 6 DML (tables with inserted values), 7 Queries (group by, update, delete, correlated, nested, plus joins, window/CTE, vector and full-text), 8 Stored Procedures, Functions and Triggers, 9 Front End. Appendices hold definitions, the data dictionary and the rubric completion status; the brief's earlier "tech stack", "vector database commands", "project tree" and "rubrics" items are covered inside chapters 1, 3, 5, 7, 8, 9 and the appendices.
- 17 new figures: screenshots of each table with its inserted values, separate UPDATE / DELETE / correlated / nested query outputs, function and trigger code, and a relational-mapping diagram drawn in the style of the sample.
- **Page numbers in the contents and lists are real, not typed:** Word (driven by automation) lays the document out, the page of every chapter, table and figure is read back from the PDF, filled into the template tables, and the layout is checked to be stable on a second pass (75 pages, no blank pages).
- Issues found and fixed on the way: table indexes in the template were assumed wrongly (which would have overwritten the contents header); leftover spacer paragraphs in the template caused blank pages and a stranded "DECLARATION" heading; `**bold**` markers appeared literally inside table cells.
- Left exactly as in the template, to be confirmed by the team: guide name (Dr. Shilpa S) and the course codes on the cover and certificate (UE23CS351A / UE24CSS351A).

