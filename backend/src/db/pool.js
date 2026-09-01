import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL client error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('PostgreSQL client connected');
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('DB query executed', { duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('DB query error', { text, error: err.message });
    throw err;
  }
};

/**
 * Get a dedicated client from pool for transactions.
 */
export const getClient = () => pool.connect();

/**
 * Run a set of SQL statements in a transaction.
 * @param {Function} callback - async fn(client) => result
 */
export const withTransaction = async (callback) => {
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
};

/**
 * Test database connectivity (used in health checks).
 */
export const testConnection = async () => {
  const result = await query('SELECT NOW() as time');
  return result.rows[0];
};

export default pool;
