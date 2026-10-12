import { createDb } from '@corkspace/db'
import { parseEnv } from '@corkspace/shared'
import { makeAuth } from '../auth'
import { demoCounts, resetDemo } from './template'

/**
 * `demo-reset` — restore the demo to its seed state: every guest (board, content, session) is
 * deleted and the template board is rebuilt from the seed in the image. Refuses to run unless
 * DEMO_MODE=on, so it can never wipe the accounts of a normal instance.
 */
const env = parseEnv()
if (env.DEMO_MODE !== 'on') {
  process.stderr.write('demo-reset: refusing to run, DEMO_MODE is not "on"\n')
  process.exit(2)
}
const { db, pool } = createDb(env.DATABASE_URL)
try {
  const { guestsRemoved, ms } = await resetDemo(db, env, makeAuth(db, env))
  const counts = await demoCounts(db)
  process.stdout.write(
    `demo-reset: ${guestsRemoved} guest(s) removed, seed restored in ${ms} ms ` +
      `(${counts.users} users, ${counts.boards} boards, ${counts.entries} entries, ` +
      `${counts.connections} threads, ${counts.sessions} sessions)\n`,
  )
} catch (err) {
  process.stderr.write(`demo-reset failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}
