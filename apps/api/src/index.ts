import { createDb, runMigrations } from '@corkspace/db'
import { parseEnv } from '@corkspace/shared'
import { serve } from '@hono/node-server'
import { buildApp } from './app'
import { makeAuth } from './auth'
import { seedAdmin } from './seed/admin'
import { ensurePersonalBoard } from './services/board-access'

const env = parseEnv()
const { db, pool } = createDb(env.DATABASE_URL)

// Production applies migrations via the dedicated compose `migrate` step (docs/adr/).
if (env.NODE_ENV !== 'production') {
  await runMigrations(env.DATABASE_URL)
}

const seeded = await seedAdmin(db, env)
console.log(seeded.created ? `seeded admin ${env.ADMIN_EMAIL}` : 'admin already present')
// The super-admin always owns a board (created here for a fresh DB; the migration created it on
// an existing prod DB). Idempotent.
await ensurePersonalBoard(db, seeded.userId, 'My board')

const auth = makeAuth(db, env)
const app = buildApp({ db, env, auth })

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`api listening on :${info.port}`)
})

// Graceful shutdown so SIGTERM (compose stop / test teardown) exits cleanly.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close()
    void pool.end()
    process.exit(0)
  })
}
