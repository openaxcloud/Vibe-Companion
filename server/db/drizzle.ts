/**
 * Drizzle ORM Instance
 * Provides direct database access for services
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../shared/schema';

// Create pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// Create drizzle instance
export const db = drizzle(pool, { schema });
