-- ============================================================================
-- PropFind Database Schema (PostgreSQL + pgvector)
-- Course: DBMS Experiential Learning - Level 3 Mini Project
-- Architecture: Option 2 (Relational SQL + Vector Database via pgvector)
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing objects for clean migrations (optional in production)
DROP VIEW IF EXISTS view_owner_analytics CASCADE;
DROP VIEW IF EXISTS view_property_catalog CASCADE;
DROP TABLE IF EXISTS booking_audit CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS property_embeddings CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS property_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- 3. Custom Enumerations / Domain Types
CREATE TYPE user_role AS ENUM ('OWNER', 'TENANT', 'ADMIN');
CREATE TYPE property_status AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE');
CREATE TYPE booking_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('UPI', 'CARD', 'NET_BANKING');
CREATE TYPE payment_status AS ENUM ('PAID', 'FAILED', 'REFUNDED');

-- 4. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TENANT',
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9 ]{10,20}$')
);

-- 5. Properties Table (Relational Catalog)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    property_type VARCHAR(50) NOT NULL DEFAULT 'Apartment',
    price_per_month NUMERIC(10, 2) NOT NULL CHECK (price_per_month > 0),
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (security_deposit >= 0),
    bedrooms INT NOT NULL CHECK (bedrooms >= 0),
    bathrooms INT NOT NULL CHECK (bathrooms >= 0),
    area_sqft INT NOT NULL CHECK (area_sqft > 0),
    address TEXT NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    status property_status NOT NULL DEFAULT 'AVAILABLE',
    amenities TEXT[] DEFAULT '{}',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Property Embeddings Table (Vector Database Paradigm)
-- 384 dimensions corresponds to sentence-transformers/all-MiniLM-L6-v2
CREATE TABLE property_embeddings (
    property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    embedding vector(384) NOT NULL,
    model_name VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    indexed_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bookings Table (Relational Workflows & Concurrency)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status booking_status NOT NULL DEFAULT 'PENDING',
    special_requests TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_booking_dates CHECK (end_date > start_date)
);

-- 8. Reviews Table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_property_review UNIQUE(property_id, tenant_id)
);


-- 9. Payments Table (Member 2): one PAID payment per approved booking
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PAID',
    transaction_ref VARCHAR(40) NOT NULL UNIQUE
        DEFAULT ('TXN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12))),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_paid_has_timestamp CHECK (status <> 'PAID' OR paid_at IS NOT NULL)
);
-- A booking can only be paid once (REFUNDED / FAILED rows do not block a new attempt)
CREATE UNIQUE INDEX uq_payments_one_paid_per_booking ON payments(booking_id) WHERE status = 'PAID';
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- 10. Booking Audit Log (Member 2): written only by trigger
CREATE TABLE booking_audit (
    id BIGSERIAL PRIMARY KEY,
    booking_id UUID NOT NULL,
    old_status booking_status,
    new_status booking_status NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_booking_audit_booking ON booking_audit(booking_id, changed_at);

-- ============================================================================
-- ADVANCED DATABASE FEATURES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Feature A: Indexing (Relational B-Tree & pgvector HNSW Vector Index)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price_per_month);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_bookings_dates ON bookings(property_id, start_date, end_date);
CREATE INDEX idx_bookings_tenant ON bookings(tenant_id);

-- pgvector Hierarchical Navigable Small World (HNSW) cosine index
-- Provides sub-linear search time over high-dimensional vector spaces
CREATE INDEX idx_property_embeddings_hnsw 
ON property_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- Feature B: Views (Complex Joins & Aggregations)
-- ----------------------------------------------------------------------------

-- 1. Property Catalog View (Relational Join + Rating Aggregates)
CREATE OR REPLACE VIEW view_property_catalog AS
SELECT 
    p.id,
    p.title,
    p.description,
    p.property_type,
    p.price_per_month,
    p.security_deposit,
    p.bedrooms,
    p.bathrooms,
    p.area_sqft,
    p.address,
    p.city,
    p.state,
    p.pincode,
    p.status,
    p.amenities,
    p.image_url,
    p.created_at,
    u.id AS owner_id,
    u.full_name AS owner_name,
    u.email AS owner_email,
    u.phone AS owner_phone,
    COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0.0) AS avg_rating,
    COUNT(r.id) AS review_count
FROM properties p
JOIN users u ON p.owner_id = u.id
LEFT JOIN reviews r ON p.id = r.property_id
GROUP BY p.id, u.id;

-- 2. Owner Analytics View (Aggregate Functions, GROUP BY, HAVING)
CREATE OR REPLACE VIEW view_owner_analytics AS
SELECT 
    u.id AS owner_id,
    u.full_name AS owner_name,
    u.email AS owner_email,
    COUNT(DISTINCT p.id) AS total_properties,
    COUNT(DISTINCT CASE WHEN p.status = 'AVAILABLE' THEN p.id END) AS available_properties,
    COUNT(DISTINCT CASE WHEN p.status = 'RENTED' THEN p.id END) AS rented_properties,
    COALESCE(ROUND(AVG(p.price_per_month)::numeric, 2), 0.00) AS avg_monthly_rent,
    COUNT(DISTINCT b.id) AS total_booking_requests,
    COUNT(DISTINCT CASE WHEN b.status = 'APPROVED' THEN b.id END) AS confirmed_bookings,
    COALESCE(SUM(CASE WHEN b.status = 'APPROVED' THEN b.total_amount ELSE 0 END), 0.00) AS total_confirmed_revenue
FROM users u
LEFT JOIN properties p ON u.id = p.owner_id
LEFT JOIN bookings b ON p.id = b.property_id
WHERE u.role = 'OWNER'
GROUP BY u.id
HAVING COUNT(p.id) >= 0;

-- ----------------------------------------------------------------------------
-- Feature C: Stored Procedures & Functions
-- ----------------------------------------------------------------------------

-- 1. Function: Auto-update timestamp
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Function: Check date conflict for bookings (Prevents Double Booking)
CREATE OR REPLACE FUNCTION fn_check_booking_conflict(
    p_property_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INT;
BEGIN
    SELECT COUNT(*)
    INTO conflict_count
    FROM bookings
    WHERE property_id = p_property_id
      AND status = 'APPROVED'
      AND (id <> p_exclude_booking_id OR p_exclude_booking_id IS NULL)
      AND (
          (start_date, end_date) OVERLAPS (p_start_date, p_end_date)
      );

    RETURN (conflict_count > 0);
END;
$$ LANGUAGE plpgsql;

-- 3. Function: Semantic Property Search using Cosine Similarity (<=> operator)
CREATE OR REPLACE FUNCTION fn_search_properties_semantic(
    p_query_vector vector(384),
    p_match_threshold DOUBLE PRECISION DEFAULT 0.20,
    p_match_count INT DEFAULT 10,
    p_city VARCHAR DEFAULT NULL,
    p_max_price NUMERIC DEFAULT NULL,
    p_bedrooms INT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    description TEXT,
    property_type VARCHAR,
    price_per_month NUMERIC,
    bedrooms INT,
    bathrooms INT,
    area_sqft INT,
    address TEXT,
    city VARCHAR,
    status property_status,
    amenities TEXT[],
    image_url TEXT,
    owner_name VARCHAR,
    avg_rating NUMERIC,
    similarity_score DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vpc.id,
        vpc.title,
        vpc.description,
        vpc.property_type,
        vpc.price_per_month,
        vpc.bedrooms,
        vpc.bathrooms,
        vpc.area_sqft,
        vpc.address,
        vpc.city,
        vpc.status,
        vpc.amenities,
        vpc.image_url,
        vpc.owner_name,
        vpc.avg_rating,
        -- Cosine distance (<=>) ranges from 0 (identical) to 2 (opposite)
        -- Similarity score is normalized to [0, 1]
        (1 - (pe.embedding <=> p_query_vector)) AS similarity_score
    FROM property_embeddings pe
    JOIN view_property_catalog vpc ON pe.property_id = vpc.id
    WHERE (1 - (pe.embedding <=> p_query_vector)) >= p_match_threshold
      AND (p_city IS NULL OR LOWER(vpc.city) = LOWER(p_city))
      AND (p_max_price IS NULL OR vpc.price_per_month <= p_max_price)
      AND (p_bedrooms IS NULL OR vpc.bedrooms = p_bedrooms)
      AND vpc.status = 'AVAILABLE'
    ORDER BY pe.embedding <=> p_query_vector ASC
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Feature D: Triggers
-- ----------------------------------------------------------------------------

-- Trigger 1: Auto-update updated_at on properties
CREATE TRIGGER trg_properties_timestamp
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION fn_update_timestamp();

-- Trigger 2: Auto-update updated_at on bookings
CREATE TRIGGER trg_bookings_timestamp
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_update_timestamp();

-- Trigger 3: Prevent overlapping confirmed bookings via trigger
CREATE OR REPLACE FUNCTION fn_trg_prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' THEN
        IF fn_check_booking_conflict(NEW.property_id, NEW.start_date, NEW.end_date, NEW.id) THEN
            RAISE EXCEPTION 'Double booking conflict: Property % is already booked for date range % to %',
                NEW.property_id, NEW.start_date, NEW.end_date;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_booking_overlap
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_trg_prevent_double_booking();


-- Trigger 4: Enforce the booking state machine at the database level
--   PENDING  -> APPROVED | REJECTED | CANCELLED
--   APPROVED -> CANCELLED
--   REJECTED / CANCELLED are terminal
CREATE OR REPLACE FUNCTION fn_trg_validate_booking_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;
    IF (OLD.status = 'PENDING'  AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED'))
    OR (OLD.status = 'APPROVED' AND NEW.status = 'CANCELLED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invalid booking status change: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_booking_transition ON bookings;
CREATE TRIGGER trg_validate_booking_transition
BEFORE UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_trg_validate_booking_transition();


-- Trigger 5: Stamp paid_at and validate payments (BEFORE INSERT/UPDATE on payments)
--   * paid_at is set automatically when status becomes PAID
--   * a PAID payment is only allowed for an APPROVED booking and must equal total_amount
CREATE OR REPLACE FUNCTION fn_trg_payment_stamp_and_validate()
RETURNS TRIGGER AS $$
DECLARE
    b_status booking_status;
    b_total NUMERIC(10, 2);
BEGIN
    IF NEW.status = 'PAID' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'PAID') THEN
        SELECT status, total_amount INTO b_status, b_total FROM bookings WHERE id = NEW.booking_id;
        IF b_status IS DISTINCT FROM 'APPROVED' THEN
            RAISE EXCEPTION 'Payment rejected: booking % is %, only APPROVED bookings can be paid',
                NEW.booking_id, COALESCE(b_status::text, 'missing');
        END IF;
        IF NEW.amount <> b_total THEN
            RAISE EXCEPTION 'Payment rejected: amount % does not match booking total %', NEW.amount, b_total;
        END IF;
        NEW.paid_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_stamp_and_validate
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_trg_payment_stamp_and_validate();

-- Trigger 6: Audit every booking status change (AFTER INSERT / UPDATE OF status)
--   The application sets app.user_id (set_config, transaction-local) so changed_by is recorded.
CREATE OR REPLACE FUNCTION fn_trg_audit_booking_status()
RETURNS TRIGGER AS $$
DECLARE
    actor UUID;
BEGIN
    BEGIN
        actor := NULLIF(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        actor := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO booking_audit (booking_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NULL, NEW.status, COALESCE(actor, NEW.tenant_id));
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO booking_audit (booking_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, actor);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_booking_status
AFTER INSERT OR UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_trg_audit_booking_status();

-- Trigger 7: Refund the payment automatically when a paid booking is cancelled
CREATE OR REPLACE FUNCTION fn_trg_refund_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
        UPDATE payments SET status = 'REFUNDED'
        WHERE booking_id = NEW.id AND status = 'PAID';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refund_on_cancel
AFTER UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_trg_refund_on_cancel();
