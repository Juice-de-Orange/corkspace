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
  // An idle client whose server went away (Postgres restart, restore, network) makes the pool
  // emit 'error'; unhandled, that event kills the process. The pool has already dropped the
  // client and opens a fresh one on the next query, so logging is all there is to do.
  pool.on('error', (err) => {
    console.error('[db] idle connection lost:', err.message)
  })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

export type Database = DbHandle['db']
