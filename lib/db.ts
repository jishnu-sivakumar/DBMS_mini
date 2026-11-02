import { Pool, QueryResult, QueryResultRow } from 'pg';

// Global pool instance to prevent connection leaks across Next.js hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (copy .env.example to .env)');
}

export const pool: Pool =
  global._pgPool ||
  new Pool({
    connectionString,
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

/**
 * Direct query execution helper
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[SQL Execution]', { text: text.slice(0, 100).trim(), duration: `${duration}ms`, rows: res.rowCount });
  }
  
  return res;
}

/**
 * Transaction helper for ACID guarantees
 */
export async function withTransaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
