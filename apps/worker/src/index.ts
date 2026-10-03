import { setTimeout as sleep } from 'node:timers/promises'
import { createDb } from '@corkspace/db'
import { parseEnv } from '@corkspace/shared'
import { runOnce } from './queue'

const env = parseEnv()
const { db, pool } = createDb(env.DATABASE_URL)

/** Pause between polls while the database is unreachable. */
const RETRY_MS = 5000

let running = true
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    running = false
    void pool.end()
    process.exit(0)
  })
}

async function main(): Promise<void> {
  await pool.query('select 1')
  console.log('[worker] image pipeline ready')
  while (running) {
    try {
      const did = await runOnce(db, env.ASSET_DIR)
      if (!did) {
        await sleep(1000)
      }
    } catch (err) {
      // The database is away (restart, restore, network). Pending assets stay queued in the
      // table, so keep polling until it is back instead of exiting.
      const reason = err instanceof Error && err.cause instanceof Error ? err.cause : err
      console.error(
        '[worker] queue unavailable, retrying:',
        reason instanceof Error ? reason.message : reason,
      )
      await sleep(RETRY_MS)
    }
  }
}

main().catch((err: unknown) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
