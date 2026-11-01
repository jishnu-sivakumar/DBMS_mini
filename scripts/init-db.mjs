import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/propfind_db';

const pool = new pg.Pool({ connectionString });

async function init() {
  console.log('🚀 Running PropFind Database Schema Initialization...');
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✅ Schema & extensions initialized successfully!');
  } catch (err) {
    console.error('❌ Schema initialization failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
