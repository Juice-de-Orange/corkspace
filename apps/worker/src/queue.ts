import type { Database } from '@corkspace/db'
import { assets } from '@corkspace/db/schema'
import { eq, sql } from 'drizzle-orm'
import { processAsset } from './image/process'

/** Atomically claim the oldest pending asset (FOR UPDATE SKIP LOCKED) → 'processing'. */
export async function claimPending(db: Database): Promise<string | null> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(
      sql`SELECT id FROM assets WHERE processing_status = 'pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
    )
    const row = (result.rows[0] ?? null) as { id: string } | null
    if (!row) {
      return null
    }
    await tx.update(assets).set({ processingStatus: 'processing' }).where(eq(assets.id, row.id))
    return row.id
  })
}

/** Process one pending asset; false if the queue was empty. Failures mark the asset 'failed'. */
export async function runOnce(db: Database, assetDir: string): Promise<boolean> {
  const id = await claimPending(db)
  if (!id) {
    return false
  }
  try {
    await processAsset(db, assetDir, id)
  } catch (err) {
    await db.update(assets).set({ processingStatus: 'failed' }).where(eq(assets.id, id))
    console.error('[worker] asset failed', id, err)
  }
  return true
}
