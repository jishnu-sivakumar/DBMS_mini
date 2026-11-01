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

| Role | Member 1 (Implemented & Working) | Member 2 (Teammate Boilerplate & Scope) |
| :--- | :--- | :--- |
| **Core Field** | **Vector Search Engine, Property Catalog & DB Architecture** | **Rental Lifecycle, Booking Concurrency & Owner Dashboard** |
| **Database** | Complete DDL schema (`db/schema.sql`), pgvector setup, HNSW index, B-tree indexes, `view_property_catalog`, `view_owner_analytics`, `fn_search_properties_semantic` | `bookings` table workflows, `fn_check_booking_conflict`, `trg_validate_booking_overlap` |
| **Backend** | Vector embedding engine (`lib/embeddings.ts`), `/api/search`, `/api/properties`, seed generator (`scripts/seed.mjs`) | Booking service (`lib/services/booking-service.ts`), `/api/bookings`, `/api/bookings/[id]` |
| **Frontend** | Home search page (`app/page.tsx`), prompt suggestions, hybrid SQL filter toolbar, property cards with match % badges, listing submission form (`app/properties/new`) | Owner Management Portal (`app/dashboard/owner`), Tenant Rental History (`app/dashboard/tenant`) |

---

## 🌟 Advanced Database Concepts Demonstrated (6 Features)

1. **Vector Similarity Search (`pgvector`)**: 384-dimensional dense vector embeddings with HNSW cosine distance (`<=>`) indexing.
2. **ACID Transactions**: Atomic property creation + vector storage transaction; row-locking reservation transactions (`SELECT ... FOR UPDATE`).
3. **Database Triggers**:
   - `trg_validate_booking_overlap`: Automatically raises an exception to prevent double-booking confirmed date ranges.
   - `trg_properties_timestamp`: Automatically synchronizes `updated_at` timestamps on row modification.
4. **Stored Procedures & Functions**:
   - `fn_search_properties_semantic`: Combines cosine similarity distance with hybrid relational SQL filters (city, max price, bedrooms).
   - `fn_check_booking_conflict`: Performs SQL temporal interval overlap checks (`OVERLAPS`).
5. **Views (Complex Joins & Aggregations)**:
   - `view_property_catalog`: Multi-table `LEFT JOIN` between properties, owners, and reviews with `ROUND(AVG(rating), 1)`.
   - `view_owner_analytics`: `GROUP BY` and `HAVING` aggregations computing listing counts, average rent, and confirmed revenue.
6. **Indexing Optimization**: B-Tree indexes on search keys + pgvector HNSW index.

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **PostgreSQL 15+** with the **`pgvector`** extension installed (or use Docker)

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Ensure `DATABASE_URL` points to your PostgreSQL instance:
```env
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/propfind_db
```

### 3. Initialize Schema & Seed Data
Initialize tables, views, procedures, and triggers:
```bash
npm run db:init
```
Seed realistic properties, owners, tenants, and 384-dimensional vector embeddings:
```bash
npm run db:seed
```

### 4. Run the Next.js Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📖 Project Documentation Directory (`docs/`)

- 📘 [docs/ARCHITECTURE.md](file:///home/jishnu/Projects/DBMS_Mini/docs/ARCHITECTURE.md): Full system architecture, ER diagrams, vector mechanics, and paradigm justifications.
- 📙 [docs/DATABASE_DESIGN.md](file:///home/jishnu/Projects/DBMS_Mini/docs/DATABASE_DESIGN.md): Complete Data Dictionary, table schemas, triggers, functions, and view definitions.
- 📗 [docs/TEAM_DIVISION.md](file:///home/jishnu/Projects/DBMS_Mini/docs/TEAM_DIVISION.md): Explicit breakdown of Member 1 vs Member 2 contributions.
- 📕 [docs/MEMBER_2_GUIDE.md](file:///home/jishnu/Projects/DBMS_Mini/docs/MEMBER_2_GUIDE.md): Step-by-step developer guide for Member 2 (the teammate) to complete their tasks and prepare for evaluation.
- 📓 [docs/DEV_LOGS.md](file:///home/jishnu/Projects/DBMS_Mini/docs/DEV_LOGS.md): Detailed engineering logs, benchmarks, query outputs, and execution results.
