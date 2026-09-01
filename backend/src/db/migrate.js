import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './pool.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  logger.info('Running database migrations...');
  const initSql = readFileSync(join(__dirname, 'init.sql'), 'utf8');
  const contextSql = readFileSync(join(__dirname, '02_farmer_context.sql'), 'utf8');
  
  const client = await pool.connect();
  try {
    logger.info('Executing init.sql...');
    await client.query(initSql);
    logger.info('Executing 02_farmer_context.sql...');
    await client.query(contextSql);
    logger.info('✅ Database migration complete');
  } catch (err) {
    logger.error('❌ Migration failed', { error: err.message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
