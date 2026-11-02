# 🏡 PropFind: Semantic Property Search & Rental Management System

> **DBMS Experiential Learning – Level 3 Mini Project**  
> **Architecture Paradigm:** Option 2: SQL Relational (PostgreSQL) + Vector Database (`pgvector`)  
> **Team Structure:** 2-Member Teamwork Implementation  

---

## 📌 Project Overview
**PropFind** is a rental discovery and property management platform that enables tenants to search for homes using natural language intent rather than rigid keyword checkboxes (e.g. *"quiet 2BHK near tech park, pet-friendly, under 25k"*). 

Listing descriptions are converted into mathematical vector embeddings and queried via **PostgreSQL `pgvector`** with **HNSW cosine similarity indexing**, while critical relational data (users, properties, bookings, reviews) maintains ACID guarantees, triggers, and foreign key integrity.

---

## 👥 2-Member Team Division of Responsibilities

| Role | Member 1 | Member 2 |
| :--- | :--- | :--- |
| **Core Field** | **Vector Search Engine, Property Catalog & DB Architecture** | **Authentication, Rental Lifecycle, Payments, Audit & SQL test suite** |
| **Database** | DDL schema, pgvector, HNSW index, B-tree indexes, `view_property_catalog`, `view_owner_analytics`, `fn_search_properties_semantic` | `fn_check_booking_conflict`, `trg_validate_booking_overlap`, booking state-machine trigger, `payments` and `booking_audit` tables with 3 triggers, `users` CHECK constraints |
| **Backend** | Embedding engine, `/api/search`, `/api/properties`, seed generator | JWT + bcrypt auth (`/api/auth/*`, `middleware.ts`), booking service with row locking, `/api/bookings`, `/api/bookings/[id]`, `/api/bookings/[id]/pay` |
| **Frontend** | Home search page, filters, property cards, listing form | Login and register pages, role-aware navbar, Owner Portal (tabs + analytics), Tenant dashboard (cancel, pay, history) |
| **Quality** | Semantic search tuning | `db/queries.sql` (report examples), `db/transactions_tests.sql` (transactions + 22 negative tests) |

---

## 🌟 Advanced Database Concepts Demonstrated (6 Features)

1. **Vector Similarity Search (`pgvector`)**: real `all-MiniLM-L6-v2` sentence embeddings (384 dimensions, via `@huggingface/transformers`) with HNSW cosine distance (`<=>`) indexing.
2. **ACID Transactions**: Atomic property creation + vector storage; row-locking booking transactions (`SELECT ... FOR UPDATE`); atomic payment (lock booking, check, insert payment).
3. **Database Triggers**:
   - `trg_validate_booking_overlap`: Automatically raises an exception to prevent double-booking confirmed date ranges.
   - `trg_validate_booking_transition`: enforces the booking state machine (`PENDING` -> `APPROVED`/`REJECTED`/`CANCELLED`, `APPROVED` -> `CANCELLED`).
   - `trg_payment_stamp_and_validate`: stamps `paid_at`; only `APPROVED` bookings can be paid, for the exact total.
   - `trg_audit_booking_status`: writes every booking status change to `booking_audit` (with the acting user).
   - `trg_refund_on_cancel`: cancelling a paid booking marks its payment `REFUNDED`.
   - `trg_properties_timestamp` / `trg_bookings_timestamp`: keep `updated_at` current.
4. **Stored Procedures & Functions**:
   - `fn_search_properties_semantic`: Combines cosine similarity distance with hybrid relational SQL filters (city, max price, bedrooms).
   - `fn_check_booking_conflict`: Performs SQL temporal interval overlap checks (`OVERLAPS`).
5. **Views (Complex Joins & Aggregations)**:
   - `view_property_catalog`: Multi-table `LEFT JOIN` between properties, owners, and reviews with `ROUND(AVG(rating), 1)`.
   - `view_owner_analytics`: `GROUP BY` and `HAVING` aggregations computing listing counts, average rent, and confirmed revenue.
6. **Indexing Optimization**: B-Tree indexes on search keys + pgvector HNSW index + a partial unique index (one `PAID` payment per booking).
7. **Authentication & Authorization**: bcrypt password hashes, JWT in an httpOnly cookie, roles `OWNER` / `TENANT` / `ADMIN`; `middleware.ts` guards pages and every API route re-checks the role.
8. **Integrity by constraints**: `CHECK`, `UNIQUE`, `FOREIGN KEY`, `ENUM` types. 22 negative tests prove each one rejects bad data.

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** 22.18+ or 24 (the seed script imports a TypeScript file)
- **Docker** (easiest way to get PostgreSQL + `pgvector`), or a local PostgreSQL 15+ with the `vector` extension

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and set your own values (the file is git-ignored; nothing secret is committed):

| Variable | Purpose |
| :--- | :--- |
| `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`, `DB_PORT` | used by `docker-compose.yml` |
| `DATABASE_URL` | connection string used by the app and scripts (must match the values above) |
| `JWT_SECRET` | long random string that signs session tokens |
| `SEED_PASSWORD` | password given to the demo accounts (default in `.env.example`: `password123`) |
| `OPENAI_API_KEY` | optional; leave empty to use the local MiniLM model |
| `COOKIE_SECURE` | set `true` only when served over HTTPS |

### 3. Start the database, create the schema, seed data
```bash
docker compose up -d        # pgvector/pgvector:pg16 on DB_PORT
npm install
npm run db:init             # tables, views, functions, triggers (safe to re-run)
npm run db:seed             # users, listings, real MiniLM embeddings, sample bookings
```
The first `db:seed` downloads the ~23 MB `all-MiniLM-L6-v2` model once and caches it.

The seed loads **58 listings in 15 cities** (rent from Rs 4,500 for a hostel bed to Rs 2,50,000 for a sea-facing penthouse; 23 listings are under Rs 20,000), 6 owners, 6 tenants, 1 admin, 44 reviews and 14 bookings in every status (some paid). The data lives in `scripts/seed-data.mjs`; photos are Unsplash images.

### 4. Run the app
```bash
npm run dev      # http://localhost:3000
npm run build    # production build check
```

### 5. Demo accounts (password = `SEED_PASSWORD`, default `password123`)

| Role | Email |
| :--- | :--- |
| Owner | `priya.sharma@example.com`, `rahul.verma@example.com`, `ananya.roy@example.com` |
| Tenant | `rohan.nair@example.com`, `sneha.patel@example.com` |
| Admin | `admin@example.com` |

You can also register a new Owner or Tenant at `/register` (nobody can self-register as Admin).

### 6. Try the full flow
1. Log in as a tenant, search *"house where I can keep my dog"* on the home page, open a listing and **Request to book**. Budget, bedrooms and city can be typed straight into the sentence, e.g. *"homes under rent 20k"* or *"pet friendly 2BHK in Pune under 25k"*; the page shows what it understood as chips. (`npm run test:parser` checks this parsing.)
2. Log in as that listing's owner, open **Owner Portal**, **Approve** the request (tabs: All / Pending / Approved / Rejected).
3. Back as the tenant, open **My Bookings** and **Pay**; use **History** to see the audit trail.
4. Make two overlapping requests for one property, approve one, then approve the other: the database trigger rejects it and the error message shows in the UI.

### 7. SQL demos and tests for the report
```bash
docker exec -i propfind-db psql -U postgres -d propfind_db < db/queries.sql
docker exec -i propfind-db psql -U postgres -d propfind_db < db/transactions_tests.sql
```
`queries.sql` covers joins, GROUP BY / HAVING, nested and correlated subqueries, UPDATE / DELETE (rolled back), views, vector similarity and full-text search. `transactions_tests.sql` demonstrates COMMIT, ROLLBACK, SAVEPOINT, atomicity and runs 22 negative tests that must each be rejected (prints PASS/FAIL; exits non-zero on any failure). Both are safe to re-run.

---

## 📖 Project Documentation Directory (`docs/`)

- 📘 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Full system architecture, ER diagrams, vector mechanics, and paradigm justifications.
- 📙 [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md): Complete Data Dictionary, table schemas, triggers, functions, and view definitions.
- 📗 [docs/TEAM_DIVISION.md](docs/TEAM_DIVISION.md): Explicit breakdown of Member 1 vs Member 2 contributions.
- 📕 [docs/MEMBER_2_GUIDE.md](docs/MEMBER_2_GUIDE.md): Step-by-step developer guide for Member 2 (the teammate) to complete their tasks and prepare for evaluation.
- 📓 [docs/DEV_LOGS.md](docs/DEV_LOGS.md): Detailed engineering logs, benchmarks, query outputs, and execution results.
