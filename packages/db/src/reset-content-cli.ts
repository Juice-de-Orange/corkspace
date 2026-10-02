import { createDb } from './client'
import { resetContent } from './reset-content'

/**
 * Guarded CLI to clear all board content (see resetContent). DESTRUCTIVE and irreversible — the only
 * recovery is a prior `scripts/backup.sh` dump. Refuses to run without an explicit confirmation
 * (`--yes` arg or `RESET_CONFIRM=yes` env) so it can never fire by accident.
 *
 *   DATABASE_URL=... pnpm --filter @corkspace/db run db:reset-content --yes
 */
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const confirmed = process.argv.includes('--yes') || process.env.RESET_CONFIRM === 'yes'
if (!confirmed) {
  console.error(
    'Refusing to reset: this DELETES ALL board content (entries/strokes/connections/frames/' +
      'teleports/tags/assets). Back up first (scripts/backup.sh), then pass --yes (or ' +
      'RESET_CONFIRM=yes) to proceed. Account, board and settings are kept.',
  )
  process.exit(1)
}

const { db, pool } = createDb(url)
resetContent(db)
  .then(() => {
    console.log('board content cleared (account/board/settings/feedback kept)')
    return pool.end()
  })
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
