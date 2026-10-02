import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index'

export type Schema = typeof schema

export interface DbHandle {
  db: ReturnType<typeof drizzle<Schema>>
  pool: Pool
}

/** Create a Drizzle client + underlying pg pool for a connection string. */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

export type Database = DbHandle['db']
