-- ============================================================================
-- PropFind: labelled SQL examples for the project report
-- Run after:  npm run db:init && npm run db:seed
-- Run with :  docker exec -i propfind-db psql -U postgres -d propfind_db < db/queries.sql
-- Statements that change data are wrapped in BEGIN ... ROLLBACK so the demo
-- data is left untouched and this file can be re-run any number of times.
-- ============================================================================
\set ON_ERROR_STOP on
\pset null '-'

-- ============================================================================
-- A. JOINS
-- ============================================================================

\echo '===== A1. INNER JOIN (4 tables): every booking with property, tenant and owner ====='
SELECT b.start_date, b.end_date, b.status,
       p.title        AS property,
       t.full_name    AS tenant,
       o.full_name    AS owner
FROM bookings b
JOIN properties p ON p.id = b.property_id
JOIN users t      ON t.id = b.tenant_id
JOIN users o      ON o.id = p.owner_id
ORDER BY b.start_date;

\echo '===== A2. LEFT JOIN: every property with its booking count (0 if never booked) ====='
SELECT p.title, p.city, COUNT(b.id) AS bookings
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY p.id, p.title, p.city
ORDER BY bookings DESC, p.title;

\echo '===== A3. LEFT JOIN + IS NULL (anti-join): properties that have no reviews ====='
SELECT p.title
FROM properties p
LEFT JOIN reviews r ON r.property_id = p.id
WHERE r.id IS NULL;

\echo '===== A4. SELF JOIN: pairs of properties in the same city (cheaper one first) ====='
SELECT a.title AS cheaper, b.title AS costlier, a.city, a.price_per_month AS price_a, b.price_per_month AS price_b
FROM properties a
JOIN properties b ON a.city = b.city AND a.price_per_month < b.price_per_month
ORDER BY a.city, a.price_per_month;

-- ============================================================================
-- B. GROUP BY, AGGREGATES, HAVING
-- ============================================================================

\echo '===== B1. GROUP BY + COUNT / AVG / MIN / MAX: price statistics per city ====='
SELECT city,
       COUNT(*)                          AS properties,
       ROUND(AVG(price_per_month), 2)    AS avg_rent,
       MIN(price_per_month)              AS min_rent,
       MAX(price_per_month)              AS max_rent
FROM properties
GROUP BY city
ORDER BY avg_rent DESC;

\echo '===== B2. HAVING: cities with at least 2 listings and average rent above 20,000 ====='
SELECT city, COUNT(*) AS properties, ROUND(AVG(price_per_month), 2) AS avg_rent
FROM properties
GROUP BY city
HAVING COUNT(*) >= 2 AND AVG(price_per_month) > 20000
ORDER BY avg_rent DESC;

\echo '===== B3. GROUP BY with SUM: revenue and count per booking status ====='
SELECT status, COUNT(*) AS bookings, SUM(total_amount) AS total_value
FROM bookings
GROUP BY status
ORDER BY bookings DESC;

\echo '===== B4. GROUP BY + COUNT(DISTINCT) + HAVING: owners whose properties received requests ====='
SELECT o.full_name AS owner,
       COUNT(DISTINCT p.id) AS properties_with_requests,
       COUNT(b.id)          AS requests
FROM users o
JOIN properties p ON p.owner_id = o.id
JOIN bookings b   ON b.property_id = p.id
GROUP BY o.id, o.full_name
HAVING COUNT(b.id) >= 1
ORDER BY requests DESC;

\echo '===== B5. Aggregate over an array column: how many listings offer each amenity ====='
SELECT amenity, COUNT(*) AS listings
FROM properties, UNNEST(amenities) AS amenity
GROUP BY amenity
HAVING COUNT(*) >= 1
ORDER BY listings DESC, amenity
LIMIT 8;

-- ============================================================================
-- C. NESTED (UNCORRELATED) SUBQUERIES
-- ============================================================================

\echo '===== C1. Scalar subquery: properties priced above the overall average ====='
SELECT title, price_per_month
FROM properties
WHERE price_per_month > (SELECT AVG(price_per_month) FROM properties)
ORDER BY price_per_month DESC;

\echo '===== C2. IN subquery: tenants who have at least one APPROVED booking ====='
SELECT full_name, email
FROM users
WHERE id IN (SELECT tenant_id FROM bookings WHERE status = 'APPROVED');

\echo '===== C3. Subquery in FROM (derived table): city with the highest average rent ====='
SELECT city, avg_rent
FROM (
    SELECT city, AVG(price_per_month) AS avg_rent
    FROM properties
    GROUP BY city
) AS city_avg
ORDER BY avg_rent DESC
LIMIT 1;

\echo '===== C4. ALL: properties more expensive than every Bengaluru listing ====='
SELECT title, city, price_per_month
FROM properties
WHERE price_per_month > ALL (SELECT price_per_month FROM properties WHERE city = 'Bengaluru');

-- ============================================================================
-- D. CORRELATED SUBQUERIES
-- ============================================================================

\echo '===== D1. Correlated: properties priced above the average of THEIR OWN city ====='
SELECT p.title, p.city, p.price_per_month
FROM properties p
WHERE p.price_per_month > (
    SELECT AVG(p2.price_per_month)
    FROM properties p2
    WHERE p2.city = p.city
)
ORDER BY p.city, p.price_per_month DESC;

\echo '===== D2. Correlated EXISTS: properties that have at least one 5-star review ====='
SELECT p.title
FROM properties p
WHERE EXISTS (
    SELECT 1 FROM reviews r WHERE r.property_id = p.id AND r.rating = 5
);

\echo '===== D3. Correlated NOT EXISTS: properties nobody has requested yet ====='
SELECT p.title, p.city
FROM properties p
WHERE NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.property_id = p.id
);

\echo '===== D4. Correlated scalar subquery in SELECT: latest booking date per property ====='
SELECT p.title,
       (SELECT MAX(b.created_at)::date FROM bookings b WHERE b.property_id = p.id) AS last_request
FROM properties p
ORDER BY last_request NULLS LAST, p.title;

-- ============================================================================
-- E. CTEs, WINDOW FUNCTIONS, SET OPERATIONS
-- ============================================================================

\echo '===== E1. WINDOW function: rank every property by rent within its city ====='
SELECT city, title, price_per_month,
       RANK() OVER (PARTITION BY city ORDER BY price_per_month DESC) AS rank_in_city
FROM properties
ORDER BY city, rank_in_city;

\echo '===== E2. CTE: owners ranked by confirmed revenue ====='
WITH revenue AS (
    SELECT p.owner_id, SUM(b.total_amount) AS confirmed_revenue
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    WHERE b.status = 'APPROVED'
    GROUP BY p.owner_id
)
SELECT u.full_name, COALESCE(r.confirmed_revenue, 0) AS confirmed_revenue
FROM users u
LEFT JOIN revenue r ON r.owner_id = u.id
WHERE u.role = 'OWNER'
ORDER BY confirmed_revenue DESC;

\echo '===== E3. UNION: everyone who is either an owner of a listing or has made a booking ====='
SELECT u.full_name, 'owner' AS involvement
FROM users u WHERE u.id IN (SELECT owner_id FROM properties)
UNION
SELECT u.full_name, 'tenant'
FROM users u WHERE u.id IN (SELECT tenant_id FROM bookings)
ORDER BY involvement, full_name;

-- ============================================================================
-- F. UPDATE and DELETE (inside a transaction, rolled back)
-- ============================================================================

\echo '===== F1. UPDATE with a subquery: raise rent 5% for owners with an APPROVED booking ====='
BEGIN;
SELECT title, price_per_month AS before FROM properties WHERE city = 'Bengaluru' ORDER BY title;
UPDATE properties
SET price_per_month = ROUND(price_per_month * 1.05, 2)
WHERE id IN (SELECT property_id FROM bookings WHERE status = 'APPROVED');
SELECT title, price_per_month AS after, updated_at > created_at AS timestamp_trigger_fired
FROM properties WHERE id IN (SELECT property_id FROM bookings WHERE status = 'APPROVED');
ROLLBACK;

\echo '===== F2. DELETE with a subquery: remove PENDING requests (audit table keeps the history) ====='
BEGIN;
SELECT COUNT(*) AS pending_before FROM bookings WHERE status = 'PENDING';
DELETE FROM bookings WHERE status = 'PENDING' AND start_date > CURRENT_DATE;
SELECT COUNT(*) AS pending_after FROM bookings WHERE status = 'PENDING';
ROLLBACK;
SELECT COUNT(*) AS pending_restored FROM bookings WHERE status = 'PENDING';

-- ============================================================================
-- G. VIEWS
-- ============================================================================

\echo '===== G1. VIEW view_property_catalog (join + AVG rating): top rated listings ====='
SELECT title, city, owner_name, avg_rating, review_count
FROM view_property_catalog
ORDER BY avg_rating DESC, review_count DESC
LIMIT 5;

\echo '===== G2. VIEW view_owner_analytics (GROUP BY + HAVING + SUM) ====='
SELECT owner_name, total_properties, total_booking_requests, confirmed_bookings, total_confirmed_revenue
FROM view_owner_analytics
ORDER BY total_confirmed_revenue DESC;

-- ============================================================================
-- H. STORED FUNCTIONS
-- ============================================================================

\echo '===== H1. fn_check_booking_conflict: is the approved booking range blocked? (true = conflict) ====='
SELECT p.title,
       fn_check_booking_conflict(p.id, DATE '2026-12-01', DATE '2026-12-10') AS conflict_dec_1_to_10,
       fn_check_booking_conflict(p.id, DATE '2027-03-01', DATE '2027-03-10') AS conflict_mar_2027
FROM properties p
WHERE p.id IN (SELECT property_id FROM bookings WHERE status = 'APPROVED');

-- ============================================================================
-- I. VECTOR SIMILARITY (pgvector, cosine distance operator <=>)
-- ============================================================================

\echo '===== I1. Listings most similar to the Manyata Tech Park apartment (nearest neighbours) ====='
SELECT p.title,
       ROUND((1 - (e.embedding <=> ref.embedding))::numeric, 3) AS cosine_similarity
FROM property_embeddings e
JOIN properties p ON p.id = e.property_id
CROSS JOIN (
    SELECT pe.embedding
    FROM property_embeddings pe JOIN properties pp ON pp.id = pe.property_id
    WHERE pp.title LIKE 'Serene 2BHK%'
) AS ref
WHERE p.title NOT LIKE 'Serene 2BHK%'
ORDER BY e.embedding <=> ref.embedding
LIMIT 3;

\echo '===== I2. Stored function fn_search_properties_semantic with a stored vector as the query ====='
SELECT title, city, ROUND(similarity_score::numeric, 3) AS similarity
FROM fn_search_properties_semantic(
    (SELECT pe.embedding FROM property_embeddings pe JOIN properties pp ON pp.id = pe.property_id
     WHERE pp.title LIKE 'Budget 1BHK Student%'),
    0.20, 3
);

\echo '===== I3. Hybrid: vector ranking + relational filters (city and price) ====='
SELECT p.title, p.city, p.price_per_month,
       ROUND((1 - (e.embedding <=> ref.embedding))::numeric, 3) AS similarity
FROM property_embeddings e
JOIN properties p ON p.id = e.property_id
CROSS JOIN (
    SELECT pe.embedding FROM property_embeddings pe JOIN properties pp ON pp.id = pe.property_id
    WHERE pp.title LIKE 'Modern Fully-Furnished Studio%'
) AS ref
WHERE p.city = 'Bengaluru' AND p.price_per_month <= 30000
ORDER BY e.embedding <=> ref.embedding
LIMIT 3;

\echo '===== I4. Vector index in use: the HNSW index exists on property_embeddings ====='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'property_embeddings' AND indexname = 'idx_property_embeddings_hnsw';

-- ============================================================================
-- J. FULL-TEXT SEARCH (ad hoc tsvector, no extra index needed for this demo size)
-- ============================================================================

\echo '===== J1. Full-text search: listings mentioning quiet AND garden (ranked) ====='
SELECT title,
       ROUND(ts_rank(to_tsvector('english', title || ' ' || description),
                     to_tsquery('english', 'quiet & garden'))::numeric, 4) AS rank
FROM properties
WHERE to_tsvector('english', title || ' ' || description) @@ to_tsquery('english', 'quiet & garden')
ORDER BY rank DESC;

-- ============================================================================
-- K. PAYMENTS AND AUDIT LOG
-- ============================================================================

\echo '===== K1. LEFT JOIN payments: approved bookings and whether they are paid ====='
SELECT b.id, p.title, b.total_amount, COALESCE(pay.status::text, 'UNPAID') AS payment
FROM bookings b
JOIN properties p ON p.id = b.property_id
LEFT JOIN payments pay ON pay.booking_id = b.id AND pay.status = 'PAID'
WHERE b.status = 'APPROVED';

\echo '===== K2. Audit log: status history written by trg_audit_booking_status ====='
SELECT a.changed_at::timestamp(0) AS at, a.old_status, a.new_status, u.full_name AS changed_by
FROM booking_audit a
LEFT JOIN users u ON u.id = a.changed_by
ORDER BY a.id
LIMIT 10;
