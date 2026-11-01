# 📐 PropFind: System Architecture & Database Design

**Project Title:** PropFind: Semantic Property Search & Rental Management System  
**Course:** DBMS Experiential Learning – Level 3 Mini-Project  
**Database Paradigm:** Option 2 (SQL Relational + Vector Database via PostgreSQL & pgvector)

---

## 1. System Architecture Overview

PropFind integrates a Next.js full-stack application with a PostgreSQL database equipped with the `pgvector` extension. The architecture bridges structured relational property management with high-dimensional vector similarity retrieval.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Browser)"]
        UI_Search["Semantic Search & Filters UI"]
        UI_Owner["Owner Management Dashboard"]
        UI_Tenant["Tenant Booking Portal"]
    end

    subgraph Backend ["Next.js Application Layer"]
        API_Search["/api/search (Semantic Route)"]
        API_Props["/api/properties (Catalog Route)"]
        API_Bookings["/api/bookings (Lifecycle Route)"]
        EmbeddingEngine["Local Vectorizer / OpenAI Pipeline (384-dim)"]
    end

    subgraph Database ["PostgreSQL 18 + pgvector 0.8"]
        pe_table[("property_embeddings (Vector Table)")]
        p_table[("properties (Relational Table)")]
        u_table[("users (Relational Table)")]
        b_table[("bookings (Relational Table)")]
        r_table[("reviews (Relational Table)")]
        
        hnsw_idx["HNSW Vector Index (Cosine Ops)"]
        btree_idx["B-Tree Indexes (City, Price, Status)"]
        
        proc_search["fn_search_properties_semantic()"]
        proc_conflict["fn_check_booking_conflict()"]
        trg_overlap["trg_validate_booking_overlap"]
        view_cat["view_property_catalog"]
        view_analytics["view_owner_analytics"]
    end

    UI_Search --> API_Search
    UI_Search --> API_Props
    UI_Owner --> API_Bookings
    UI_Tenant --> API_Bookings

    API_Search --> EmbeddingEngine
    EmbeddingEngine -- "384-dim query vector" --> proc_search
    proc_search --> pe_table
    proc_search --> view_cat
    pe_table -. "Indexed by" .-> hnsw_idx

    API_Props --> p_table
    API_Props --> pe_table
    API_Bookings --> proc_conflict
    API_Bookings --> b_table
    b_table -. "Validated by" .-> trg_overlap
```

---

## 2. Dual Paradigm Justification (SQL + Vector)

The DBMS Level 3 project guidelines stipulate that database paradigms must be selected based on problem requirements and justified based on data characteristics:

### Why Relational SQL (PostgreSQL)?
- **Relational Integrity**: Entities like Users (Owners & Tenants), Properties, Bookings, and Reviews are intrinsically relational and require strict foreign key constraints (`ON DELETE CASCADE` / `RESTRICT`).
- **ACID Transactions**: Financial transactions (rent, deposits) and reservation scheduling must adhere to strict serializability. Concurrent booking requests must not double-book a rental property.
- **Aggregations & Complex Analytics**: Calculating owner revenue, occupancy rates, and average star ratings demands multi-table `JOIN`, `GROUP BY`, and `HAVING` clauses.

### Why Vector Database (`pgvector`)?
- **Natural Language Discovery**: Traditional keyword search (SQL `LIKE %word%`) fails when a tenant searches for subjective concepts such as *"quiet 2BHK near tech park pet-friendly under 25k"*. A property described as *"peaceful apartment close to Manyata IT hub with open balcony"* would be missed by keyword matching.
- **Unified Engine**: By leveraging `pgvector`, vectors reside in the same database instance as relational records. This eliminates cross-system sync latency, dual-database consistency headaches, and distributed transaction overhead.

---

## 3. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ PROPERTIES : "owns"
    USERS ||--o{ BOOKINGS : "requests"
    USERS ||--o{ REVIEWS : "writes"
    PROPERTIES ||--|| PROPERTY_EMBEDDINGS : "has embedding"
    PROPERTIES ||--o{ BOOKINGS : "reserved in"
    PROPERTIES ||--o{ REVIEWS : "evaluated in"

    USERS {
        uuid id PK
        string full_name
        string email UK
        string password_hash
        enum role
        string phone
        timestamp created_at
    }

    PROPERTIES {
        uuid id PK
        uuid owner_id FK
        string title
        text description
        string property_type
        numeric price_per_month
        numeric security_deposit
        int bedrooms
        int bathrooms
        int area_sqft
        text address
        string city
        enum status
        text_array amenities
        timestamp created_at
    }

    PROPERTY_EMBEDDINGS {
        uuid property_id PK,FK
        vector embedding
        string model_name
        text indexed_content
        timestamp updated_at
    }

    BOOKINGS {
        uuid id PK
        uuid property_id FK
        uuid tenant_id FK
        date start_date
        date end_date
        numeric total_amount
        enum status
        text special_requests
        timestamp created_at
    }

    REVIEWS {
        uuid id PK
        uuid property_id FK
        uuid tenant_id FK
        int rating
        text comment
        timestamp created_at
    }
```

---

## 4. Vector Embedding & Retrieval Mechanics

1. **Dimensionality**: 384 dimensions (Sentence-Transformers / `all-MiniLM-L6-v2` standard).
2. **Indexing Algorithm**: Hierarchical Navigable Small World (**HNSW**):
   ```sql
   CREATE INDEX idx_property_embeddings_hnsw 
   ON property_embeddings 
   USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);
   ```
3. **Similarity Operator**: Cosine distance operator `<=>`.
   - Distance ranges from $0$ (identical vectors) to $2$ (diametrically opposite).
   - Similarity score formula: $\text{Similarity} = 1 - (\mathbf{v}_1 \Leftrightarrow \mathbf{v}_2)$.
   - Match percentage displayed in UI: $\text{Match \%} = \text{ROUND}(\text{Similarity} \times 100, 1)$.
