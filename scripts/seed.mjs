import pg from 'pg';
import bcrypt from 'bcryptjs';
// Same embedding code the app uses (real all-MiniLM-L6-v2 via transformers.js)
import {
  generateLocalEmbedding,
  buildPropertySearchText,
  toVectorLiteral,
  LOCAL_MODEL_NAME,
  isUsingFallbackEmbeddings,
} from '../lib/embeddings.ts';
import { owners, tenants, admin, properties, reviews, bookings } from './seed-data.mjs';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

// Hosted databases (Supabase, Neon, ...) require TLS: set DATABASE_SSL=true in .env
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({ connectionString, ssl });

// Whole months between two ISO dates (30-day blocks, minimum 1), same rule as the app
function monthsBetween(start, end) {
  const days = Math.round((new Date(end) - new Date(start)) / 86_400_000);
  return Math.max(1, Math.round(days / 30));
}

async function seed() {
  console.log('--- Starting PropFind Database Seeding ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear existing data (children first)
    console.log('Clearing old sample records...');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM booking_audit');
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM bookings');
    await client.query('DELETE FROM property_embeddings');
    await client.query('DELETE FROM properties');
    await client.query('DELETE FROM users');

    // 2. Users: owners, tenants and one admin, all with a bcrypt-hashed demo password
    console.log('Inserting owners, tenants and admin...');
    const demoPassword = process.env.SEED_PASSWORD || 'password123';
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    const insertUser = async ([name, email, phone], role) => {
      const r = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone)
         VALUES ($1, $2, $3, $4::user_role, $5)
         RETURNING id`,
        [name, email, passwordHash, role, phone]
      );
      return r.rows[0].id;
    };

    const ownerIds = [];
    for (const o of owners) ownerIds.push(await insertUser(o, 'OWNER'));
    const tenantIds = [];
    for (const t of tenants) tenantIds.push(await insertUser(t, 'TENANT'));
    await insertUser(admin, 'ADMIN');

    // 3. Properties
    console.log(`Inserting ${properties.length} properties...`);
    const inserted = [];
    for (const p of properties) {
      const r = await client.query(
        `INSERT INTO properties (
          owner_id, title, description, property_type, price_per_month,
          security_deposit, bedrooms, bathrooms, area_sqft, address,
          city, state, pincode, status, amenities, image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'AVAILABLE', $14, $15)
        RETURNING *`,
        [
          ownerIds[p.owner], p.title, p.description, p.property_type, p.price_per_month,
          p.security_deposit, p.bedrooms, p.bathrooms, p.area_sqft, p.address,
          p.city, p.state, p.pincode, p.amenities, p.image_url,
        ]
      );
      inserted.push(r.rows[0]);
    }

    // 4. Real all-MiniLM-L6-v2 embeddings for every listing
    console.log('Generating 384-dimensional all-MiniLM-L6-v2 embeddings (first run downloads the model)...');
    for (const prop of inserted) {
      const searchContent = buildPropertySearchText(prop);
      const embedding = await generateLocalEmbedding(searchContent);
      await client.query(
        `INSERT INTO property_embeddings (property_id, embedding, model_name, indexed_content)
         VALUES ($1, $2::vector, $3, $4)`,
        [prop.id, toVectorLiteral(embedding), LOCAL_MODEL_NAME, searchContent]
      );
    }

    // The stored vectors must come from the real model, otherwise search compares unlike vectors
    if (isUsingFallbackEmbeddings() && process.env.ALLOW_FALLBACK_EMBEDDINGS !== 'true') {
      throw new Error(
        'The all-MiniLM-L6-v2 model could not be loaded, so only fallback vectors were produced. ' +
          'Check your internet connection (first run downloads the model) or raise EMBEDDING_LOAD_TIMEOUT_MS, ' +
          'then run the seed again. Set ALLOW_FALLBACK_EMBEDDINGS=true to seed with fallback vectors anyway.'
      );
    }

    // 5. Reviews
    console.log(`Inserting ${reviews.length} tenant reviews...`);
    for (const [pi, ti, rating, comment] of reviews) {
      await client.query(
        `INSERT INTO reviews (property_id, tenant_id, rating, comment) VALUES ($1, $2, $3, $4)`,
        [inserted[pi].id, tenantIds[ti], rating, comment]
      );
    }

    // 6. Bookings: inserted as PENDING, then moved through the real state machine so the
    //    audit trigger records the history. Paid ones go through the payment trigger.
    console.log(`Inserting ${bookings.length} sample bookings (all statuses)...`);
    for (const [pi, ti, start, end, status, request, paid] of bookings) {
      const prop = inserted[pi];
      const total = Number(prop.price_per_month) * monthsBetween(start, end);
      const b = await client.query(
        `INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount, special_requests)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [prop.id, tenantIds[ti], start, end, total, request]
      );
      if (status !== 'PENDING') {
        await client.query(`UPDATE bookings SET status = $1::booking_status WHERE id = $2`, [status, b.rows[0].id]);
      }
      if (paid) {
        await client.query(
          `INSERT INTO payments (booking_id, amount, method, status) VALUES ($1, $2, 'UPI', 'PAID')`,
          [b.rows[0].id, total]
        );
      }
    }

    await client.query('COMMIT');

    const counts = await client.query(
      `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM properties) AS properties,
              (SELECT COUNT(DISTINCT city) FROM properties) AS cities, (SELECT COUNT(*) FROM reviews) AS reviews,
              (SELECT COUNT(*) FROM bookings) AS bookings, (SELECT COUNT(*) FROM payments) AS payments`
    );
    console.log('Seeded:', counts.rows[0]);
    console.log('✅ PropFind Database Seeded Successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
