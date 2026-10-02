import type { Database } from './client'
import {
  assets,
  connections,
  entries,
  entryTags,
  entryVersions,
  frames,
  strokes,
  tags,
  teleports,
} from './schema/index'

/**
 * Clear ALL board CONTENT while preserving the tenancy + identity:
 *   - REMOVED: entries, entry_versions, entry_tags, strokes, connections, frames, teleports, tags,
 *     assets (every board's content — single tenant today).
 *   - KEPT: user/session/account (login), boards/board_members/board_shares (the board itself + who
 *     can reach it), app_settings + boards.settings (appearance), feedback.
 *
 * Runs in one transaction, deleting children before parents so no FK is violated regardless of the
 * cascade config. After this the board loads empty and the owner can start fresh. On-disk asset
 * files under ASSET_DIR are NOT touched here (harmless orphans); the CLI documents clearing them.
 */
export async function resetContent(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(entryTags)
    await tx.delete(entryVersions)
    await tx.delete(strokes)
    await tx.delete(connections)
    await tx.delete(entries)
    await tx.delete(tags)
    await tx.delete(frames)
    await tx.delete(teleports)
    await tx.delete(assets)
  })
}
