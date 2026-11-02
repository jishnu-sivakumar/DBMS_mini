-- ============================================================================
-- PropFind: transactions and integrity tests for the project report
-- Run after:  npm run db:init && npm run db:seed
-- Run with :  docker exec -i propfind-db psql -U postgres -d propfind_db < db/transactions_tests.sql
--
-- Part 1  ACID demos: BEGIN/COMMIT, ROLLBACK, SAVEPOINT, atomicity
-- Part 2  Negative tests: every one must be REJECTED by a CHECK / UNIQUE / FK / trigger
-- Part 3  Self-check summary (PASS / FAIL per test)
--
-- The script creates its own "tx.*" users and property, and removes them again at
-- the end, so it can be re-run safely and does not disturb the seed data.
-- ============================================================================
\set ON_ERROR_STOP off
\pset null '-'
\set QUIET on

-- ---------------------------------------------------------------------------
-- 0. Clean leftovers from an aborted earlier run, then create test fixtures
-- ---------------------------------------------------------------------------
DELETE FROM payments       WHERE booking_id IN (SELECT b.id FROM bookings b JOIN properties p ON p.id = b.property_id WHERE p.title LIKE 'TX Test%');
DELETE FROM booking_audit  WHERE booking_id IN (SELECT b.id FROM bookings b JOIN properties p ON p.id = b.property_id WHERE p.title LIKE 'TX Test%');
DELETE FROM bookings       WHERE property_id IN (SELECT id FROM properties WHERE title LIKE 'TX Test%');
DELETE FROM properties     WHERE title LIKE 'TX Test%';
DELETE FROM users          WHERE email LIKE 'tx.%@example.com';

INSERT INTO users (full_name, email, password_hash, role) VALUES ('TX Owner',   'tx.owner@example.com',   'not-a-real-hash', 'OWNER')  RETURNING id AS tx_owner \gset
INSERT INTO users (full_name, email, password_hash, role) VALUES ('TX Tenant1', 'tx.tenant1@example.com', 'not-a-real-hash', 'TENANT') RETURNING id AS tx_t1 \gset
INSERT INTO users (full_name, email, password_hash, role) VALUES ('TX Tenant2', 'tx.tenant2@example.com', 'not-a-real-hash', 'TENANT') RETURNING id AS tx_t2 \gset
INSERT INTO properties (owner_id, title, description, price_per_month, bedrooms, bathrooms, area_sqft, address, city, state, pincode)
VALUES (:'tx_owner', 'TX Test Property', 'Fixture for transaction tests', 10000, 2, 1, 800, '1 Test Street', 'Testville', 'TS', '000001')
RETURNING id AS tx_prop \gset

CREATE TEMP TABLE test_results (n SERIAL, label TEXT, ok BOOLEAN, detail TEXT);

-- Helper: run a statement that MUST fail with the expected SQLSTATE (or be accepted if
-- the expectation is 'OK'). The attempt is
-- always rolled back by the helper, so a wrongly accepted statement leaves no trace.
CREATE FUNCTION pg_temp.expect_error(p_label TEXT, p_sql TEXT, p_state TEXT) RETURNS VOID AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
        RAISE EXCEPTION 'statement was accepted' USING ERRCODE = 'XX999';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = 'XX999' THEN
            -- p_state = 'OK' marks a positive control that is expected to be accepted
            INSERT INTO test_results (label, ok, detail)
            VALUES (p_label, p_state = 'OK',
                    CASE WHEN p_state = 'OK' THEN 'accepted, as expected' ELSE 'NO ERROR: statement was accepted' END);
        ELSIF SQLSTATE = p_state THEN
            INSERT INTO test_results (label, ok, detail) VALUES (p_label, TRUE, SQLSTATE || ' ' || SQLERRM);
        ELSE
            INSERT INTO test_results (label, ok, detail)
            VALUES (p_label, FALSE, 'expected ' || p_state || ' but got ' || SQLSTATE || ' ' || SQLERRM);
        END IF;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 1: TRANSACTIONS
-- ============================================================================

\echo
\echo '===== T1. BEGIN ... COMMIT: create a booking, it is durable after COMMIT ====='
BEGIN;
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount)
VALUES (:'tx_prop', :'tx_t1', '2030-01-01', '2030-02-01', 10000)
RETURNING id AS bk_a \gset
SELECT status, total_amount FROM bookings WHERE id = :'bk_a';
COMMIT;
SELECT 'after COMMIT, other sessions see it' AS note, COUNT(*) AS rows_found FROM bookings WHERE id = :'bk_a';

\echo
\echo '===== T2. Owner approves: transition + overlap triggers run, audit row is written ====='
SELECT set_config('app.user_id', :'tx_owner', false) AS acting_user \gset
UPDATE bookings SET status = 'APPROVED' WHERE id = :'bk_a';
SELECT a.old_status, a.new_status, u.full_name AS changed_by
FROM booking_audit a LEFT JOIN users u ON u.id = a.changed_by
WHERE a.booking_id = :'bk_a' ORDER BY a.id;

\echo
\echo '===== T3. Tenant pays: trigger stamps paid_at automatically ====='
INSERT INTO payments (booking_id, amount, method) VALUES (:'bk_a', 10000, 'UPI');
SELECT amount, method, status, paid_at IS NOT NULL AS paid_at_stamped FROM payments WHERE booking_id = :'bk_a';

\echo
\echo '===== T4. ROLLBACK: changes inside an aborted transaction disappear ====='
SELECT price_per_month AS price_before FROM properties WHERE id = :'tx_prop';
BEGIN;
UPDATE properties SET price_per_month = 1 WHERE id = :'tx_prop';
SELECT price_per_month AS price_inside_txn FROM properties WHERE id = :'tx_prop';
ROLLBACK;
SELECT price_per_month AS price_after_rollback FROM properties WHERE id = :'tx_prop';

\echo
\echo '===== T5. SAVEPOINT: undo only part of a transaction ====='
BEGIN;
INSERT INTO reviews (property_id, tenant_id, rating, comment) VALUES (:'tx_prop', :'tx_t1', 5, 'kept');
SAVEPOINT after_first_review;
INSERT INTO reviews (property_id, tenant_id, rating, comment) VALUES (:'tx_prop', :'tx_t2', 1, 'undone');
ROLLBACK TO SAVEPOINT after_first_review;
COMMIT;
SELECT u.full_name, r.rating, r.comment FROM reviews r JOIN users u ON u.id = r.tenant_id WHERE r.property_id = :'tx_prop';

\echo
\echo '===== T6. Atomicity: one failing statement undoes the whole transaction ====='
BEGIN;
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount)
VALUES (:'tx_prop', :'tx_t2', '2031-01-01', '2031-02-01', 10000);       -- valid
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount, status)
VALUES (:'tx_prop', :'tx_t2', '2030-01-10', '2030-01-20', 10000, 'APPROVED');  -- overlaps booking A -> trigger error
COMMIT;                                                                  -- becomes ROLLBACK
SELECT COUNT(*) AS tenant2_bookings_after_failed_txn FROM bookings WHERE tenant_id = :'tx_t2';

\echo
\echo '===== T7. Row locking (see docs/MEMBER_2_GUIDE.md): FOR UPDATE inside a transaction ====='
BEGIN;
SELECT id, price_per_month FROM properties WHERE id = :'tx_prop' FOR UPDATE;
-- A second session running the same SELECT ... FOR UPDATE would now WAIT until this COMMIT.
COMMIT;

-- ============================================================================
-- PART 2: NEGATIVE TESTS (each must be rejected by the database)
-- ============================================================================
-- Extra fixtures: a PENDING booking (tenant2) and a REJECTED booking (tenant2)
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount)
VALUES (:'tx_prop', :'tx_t2', '2032-01-01', '2032-02-01', 10000) RETURNING id AS bk_pending \gset
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount)
VALUES (:'tx_prop', :'tx_t2', '2033-01-01', '2033-02-01', 10000) RETURNING id AS bk_rej \gset
UPDATE bookings SET status = 'REJECTED' WHERE id = :'bk_rej';

\o /dev/null
-- ---- UNIQUE ----
SELECT pg_temp.expect_error('N01 UNIQUE  duplicate user email',
  format('INSERT INTO users (full_name,email,password_hash) VALUES (%L,%L,%L)', 'Dup', 'tx.owner@example.com', 'x'), '23505');
SELECT pg_temp.expect_error('N02 UNIQUE  second review by the same tenant for one property',
  format('INSERT INTO reviews (property_id,tenant_id,rating) VALUES (%L,%L,4)', :'tx_prop', :'tx_t1'), '23505');
SELECT pg_temp.expect_error('N03 UNIQUE  second PAID payment for one booking (partial unique index)',
  format('INSERT INTO payments (booking_id,amount,method) VALUES (%L,10000,%L)', :'bk_a', 'CARD'), '23505');

-- ---- CHECK ----
SELECT pg_temp.expect_error('N04 CHECK   invalid email format',
  format('INSERT INTO users (full_name,email,password_hash) VALUES (%L,%L,%L)', 'Bad', 'not-an-email', 'x'), '23514');
SELECT pg_temp.expect_error('N05 CHECK   invalid phone format',
  format('INSERT INTO users (full_name,email,password_hash,phone) VALUES (%L,%L,%L,%L)', 'Bad', 'tx.phone@example.com', 'x', 'abc'), '23514');
SELECT pg_temp.expect_error('N06 CHECK   property price must be > 0',
  format('INSERT INTO properties (owner_id,title,description,price_per_month,bedrooms,bathrooms,area_sqft,address,city,state,pincode) VALUES (%L,%L,%L,0,1,1,500,%L,%L,%L,%L)',
         :'tx_owner', 'TX Test Zero', 'd', 'a', 'c', 's', '1'), '23514');
SELECT pg_temp.expect_error('N07 CHECK   negative bedrooms',
  format('INSERT INTO properties (owner_id,title,description,price_per_month,bedrooms,bathrooms,area_sqft,address,city,state,pincode) VALUES (%L,%L,%L,5000,-1,1,500,%L,%L,%L,%L)',
         :'tx_owner', 'TX Test Neg', 'd', 'a', 'c', 's', '1'), '23514');
SELECT pg_temp.expect_error('N08 CHECK   booking end date must be after start date',
  format('INSERT INTO bookings (property_id,tenant_id,start_date,end_date,total_amount) VALUES (%L,%L,%L,%L,1)',
         :'tx_prop', :'tx_t1', '2034-02-01', '2034-01-01'), '23514');
SELECT pg_temp.expect_error('N09 CHECK   booking total_amount cannot be negative',
  format('INSERT INTO bookings (property_id,tenant_id,start_date,end_date,total_amount) VALUES (%L,%L,%L,%L,-5)',
         :'tx_prop', :'tx_t1', '2034-01-01', '2034-02-01'), '23514');
SELECT pg_temp.expect_error('N10 CHECK   review rating must be 1-5',
  format('INSERT INTO reviews (property_id,tenant_id,rating) VALUES (%L,%L,6)', :'tx_prop', :'tx_t2'), '23514');
SELECT pg_temp.expect_error('N11 CHECK   payment amount must be > 0',
  format('INSERT INTO payments (booking_id,amount,method,status) VALUES (%L,0,%L,%L)', :'bk_a', 'UPI', 'FAILED'), '23514');

-- ---- FOREIGN KEY ----
SELECT pg_temp.expect_error('N12 FK      property with a non-existent owner',
  format('INSERT INTO properties (owner_id,title,description,price_per_month,bedrooms,bathrooms,area_sqft,address,city,state,pincode) VALUES (uuid_generate_v4(),%L,%L,5000,1,1,500,%L,%L,%L,%L)',
         'TX Test Orphan', 'd', 'a', 'c', 's', '1'), '23503');
SELECT pg_temp.expect_error('N13 FK      booking for a non-existent tenant',
  format('INSERT INTO bookings (property_id,tenant_id,start_date,end_date,total_amount) VALUES (%L,uuid_generate_v4(),%L,%L,1)',
         :'tx_prop', '2034-01-01', '2034-02-01'), '23503');
SELECT pg_temp.expect_error('N14 FK      payment for a non-existent booking',
  'INSERT INTO payments (booking_id,amount,method,status) VALUES (uuid_generate_v4(),100,''UPI'',''FAILED'')', '23503');
SELECT pg_temp.expect_error('N15 FK      cannot delete a property that still has bookings (ON DELETE RESTRICT)',
  format('DELETE FROM properties WHERE id = %L', :'tx_prop'), '23503');

-- ---- ENUM / TYPE ----
SELECT pg_temp.expect_error('N16 ENUM    invalid user role',
  format('INSERT INTO users (full_name,email,password_hash,role) VALUES (%L,%L,%L,%L)', 'X', 'tx.role@example.com', 'x', 'SUPERUSER'), '22P02');
SELECT pg_temp.expect_error('N17 TYPE    embedding with the wrong number of dimensions',
  format('INSERT INTO property_embeddings (property_id,embedding,indexed_content) VALUES (%L,%L,%L)', :'tx_prop', '[0.1,0.2,0.3]', 'x'), '22000');

-- ---- TRIGGERS ----
SELECT pg_temp.expect_error('N18 TRIGGER overlapping APPROVED booking (trg_validate_booking_overlap)',
  format('INSERT INTO bookings (property_id,tenant_id,start_date,end_date,total_amount,status) VALUES (%L,%L,%L,%L,1,%L)',
         :'tx_prop', :'tx_t2', '2030-01-15', '2030-02-15', 'APPROVED'), 'P0001');
SELECT pg_temp.expect_error('N19 TRIGGER REJECTED booking cannot be approved (trg_validate_booking_transition)',
  format('UPDATE bookings SET status = %L WHERE id = %L', 'APPROVED', :'bk_rej'), 'P0001');
SELECT pg_temp.expect_error('N20 TRIGGER APPROVED booking cannot go back to PENDING',
  format('UPDATE bookings SET status = %L WHERE id = %L', 'PENDING', :'bk_a'), 'P0001');
SELECT pg_temp.expect_error('N21 TRIGGER payment for a PENDING booking (trg_payment_stamp_and_validate)',
  format('INSERT INTO payments (booking_id,amount,method) VALUES (%L,10000,%L)', :'bk_pending', 'UPI'), 'P0001');
SELECT pg_temp.expect_error('N22 TRIGGER payment amount differs from booking total',
  format('INSERT INTO payments (booking_id,amount,method) VALUES (%L,1,%L)', :'bk_a', 'UPI'), 'P0001');

-- ---- POSITIVE CONTROL: the same kind of statement succeeds when it is valid ----
SELECT pg_temp.expect_error('C01 control: valid, non-overlapping APPROVED booking is accepted (must NOT fail)',
  format('INSERT INTO bookings (property_id,tenant_id,start_date,end_date,total_amount,status) VALUES (%L,%L,%L,%L,1,%L)',
         :'tx_prop', :'tx_t2', '2035-01-01', '2035-02-01', 'APPROVED'), 'OK');

\o

-- ---- Cancelling a paid booking refunds the payment (trg_refund_on_cancel) ----
\echo
\echo '===== T8. Cancelling a paid booking: payment becomes REFUNDED automatically ====='
UPDATE bookings SET status = 'CANCELLED' WHERE id = :'bk_a';
SELECT p.status AS payment_status, p.paid_at IS NOT NULL AS paid_at_kept FROM payments p WHERE p.booking_id = :'bk_a';
SELECT a.old_status, a.new_status FROM booking_audit a WHERE a.booking_id = :'bk_a' ORDER BY a.id;

-- ---------------------------------------------------------------------------
-- Clean up the fixtures
-- ---------------------------------------------------------------------------
DELETE FROM payments      WHERE booking_id IN (SELECT id FROM bookings WHERE property_id = :'tx_prop');
DELETE FROM booking_audit WHERE booking_id IN (SELECT id FROM bookings WHERE property_id = :'tx_prop');
DELETE FROM bookings      WHERE property_id = :'tx_prop';
DELETE FROM properties    WHERE id = :'tx_prop';
DELETE FROM users         WHERE email LIKE 'tx.%@example.com';

-- ============================================================================
-- PART 3: SUMMARY
-- ============================================================================
\echo
\echo '===== NEGATIVE TEST RESULTS ====='
SELECT label, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, detail FROM test_results ORDER BY n;

\echo
\set ON_ERROR_STOP on
SELECT COUNT(*) FILTER (WHERE ok)     AS passed,
       COUNT(*) FILTER (WHERE NOT ok) AS failed
FROM test_results;

DO $$
DECLARE failed INT;
BEGIN
    SELECT COUNT(*) INTO failed FROM test_results WHERE NOT ok;
    IF failed > 0 THEN
        RAISE EXCEPTION '% integrity test(s) failed, see list above', failed;
    END IF;
END $$;
