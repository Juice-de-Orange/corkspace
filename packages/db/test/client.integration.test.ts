import { setTimeout as sleep } from 'node:timers/promises'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/client'
import { startTestDb, type TestDb } from '../src/testing/postgres'

describe('createDb pool', () => {
  let tdb: TestDb

  beforeAll(async () => {
    tdb = await startTestDb()
  })

  afterAll(async () => {
    await tdb?.stop()
  })

  it('survives the server dropping its idle connections and reconnects', async () => {
    const { db, pool } = createDb(tdb.url)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const uncaught: unknown[] = []
    const onUncaught = (err: unknown) => uncaught.push(err)
    process.on('uncaughtException', onUncaught)
    try {
      await db.execute(sql`select 1`) // leaves one idle client in the pool
      expect(pool.idleCount).toBe(1)

      // What a Postgres restart looks like to an idle client: the backend goes away under it.
      await tdb.db.execute(
        sql`select pg_terminate_backend(pid) from pg_stat_activity
            where datname = current_database() and pid <> pg_backend_pid()`,
      )
      for (let i = 0; i < 50 && pool.totalCount > 0; i++) {
        await sleep(100)
      }
      expect(pool.totalCount).toBe(0) // the dead client was noticed and dropped

      // The pool reports the loss as an 'error' event. With no listener that is an uncaught
      // exception, which kills the process; createDb logs it instead.
      expect(uncaught).toEqual([])
      expect(logged).toHaveBeenCalledWith(
        '[db] idle connection lost:',
        expect.stringContaining('terminating connection'),
      )

      const again = await db.execute(sql`select 1 as one`)
      expect(again.rows).toEqual([{ one: 1 }])
    } finally {
      process.off('uncaughtException', onUncaught)
      logged.mockRestore()
      await pool.end()
    }
  })
})
