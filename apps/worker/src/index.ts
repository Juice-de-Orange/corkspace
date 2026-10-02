import { setTimeout as sleep } from 'node:timers/promises'
import { createDb } from '@corkspace/db'
import { parseEnv } from '@corkspace/shared'
import { runOnce } from './queue'

const env = parseEnv()
const { db, pool } = createDb(env.DATABASE_URL)

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
    const did = await runOnce(db, env.ASSET_DIR)
    if (!did) {
      await sleep(1000)
    }
  }
}

main().catch((err: unknown) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
