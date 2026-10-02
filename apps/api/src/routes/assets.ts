import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { assets, entries } from '@corkspace/db/schema'
import { ALLOWED_IMAGE_MIME, sniffImageMime } from '@corkspace/shared'
import { and, eq, isNull } from 'drizzle-orm'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireAuth } from '../middleware/auth'
import { requireBoardEditor } from '../middleware/board'
import { assetPath, writeOriginal } from '../services/asset-storage'
import { type BoardAccess, resolveBoardAccess } from '../services/board-access'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const fromUrlSchema = z.object({ url: z.string().url() })
const allowed = ALLOWED_IMAGE_MIME as readonly string[]

/** Whether `access` may see an asset attached to board `boardId`: it may see private content, OR the
 *  asset is referenced by a PUBLIC, non-deleted entry on that board. Shared by the byte-serving and
 *  the status routes so a viewer cannot read a private-entry asset's metadata (parity between them). */
async function accessCanSeeAsset(
  db: AppDeps['db'],
  assetId: string,
  boardId: string,
  access: BoardAccess,
): Promise<boolean> {
  if (access.canSeePrivate) {
    return true
  }
  const ref = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.imageAssetId, assetId),
        eq(entries.boardId, boardId),
        eq(entries.visibility, 'public'),
        isNull(entries.deletedAt),
      ),
    )
    .limit(1)
  return ref.length > 0
}

/**
 * Serve an asset's bytes to a caller with resolved access to the asset's board. Authorized iff the
 * caller may see private content on that board, OR the asset is referenced by a public, non-deleted
 * entry on that board. Reused by the session serve route and the public-token tree.
 */
export async function serveAssetForAccess(
  c: Context<AppEnv>,
  deps: AppDeps,
  id: string,
  access: BoardAccess,
) {
  const db = deps.db
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  const asset = rows[0]
  if (!asset || asset.boardId !== access.boardId) {
    return c.json({ error: 'not found' }, 404)
  }
  if (asset.processingStatus === 'failed') {
    return c.json({ error: 'not available' }, 404)
  }
  if (!(await accessCanSeeAsset(db, id, access.boardId, access))) {
    return c.json({ error: 'not found' }, 404)
  }
  const variants = (asset.variants ?? {}) as Record<string, string>
  const requested = c.req.query('v')
  const rel = (requested && variants[requested]) || asset.originalPath || Object.values(variants)[0]
  if (!rel) {
    return c.json({ error: 'not ready' }, 404)
  }
  const buf = await readFile(assetPath(deps.env.ASSET_DIR, rel)).catch(() => null)
  if (!buf) {
    return c.json({ error: 'not found' }, 404)
  }
  const contentType = rel.endsWith('.webp')
    ? 'image/webp'
    : (asset.mime ?? 'application/octet-stream')
  return c.body(buf, 200, {
    'content-type': contentType,
    'cache-control': 'public, max-age=31536000, immutable',
  })
}

/** Serve asset bytes / status by global id at /api/assets. Board resolved from the asset. */
export function assetsServeRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  r.get('/:id/status', requireAuth, async (c) => {
    const user = c.get('user') as SessionUser
    const id = c.req.param('id')
    const rows = await db
      .select({
        boardId: assets.boardId,
        status: assets.processingStatus,
        variants: assets.variants,
        width: assets.width,
        height: assets.height,
      })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1)
    const a = rows[0]
    if (!a) {
      return c.json({ error: 'not found' }, 404)
    }
    const access = await resolveBoardAccess(db, user, a.boardId)
    if (access.level === 'none' || !(await accessCanSeeAsset(db, id, a.boardId, access))) {
      return c.json({ error: 'not found' }, 404)
    }
    return c.json({ status: a.status, variants: a.variants, width: a.width, height: a.height })
  })

  r.get('/:id', requireAuth, async (c) => {
    const user = c.get('user') as SessionUser
    const id = c.req.param('id')
    const rows = await db
      .select({ boardId: assets.boardId })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1)
    const a = rows[0]
    if (!a) {
      return c.json({ error: 'not found' }, 404)
    }
    const access = await resolveBoardAccess(db, user, a.boardId)
    if (access.level === 'none') {
      return c.json({ error: 'not found' }, 404)
    }
    return serveAssetForAccess(c, deps, id, access)
  })

  return r
}

/** Board-scoped uploads, mounted under /api/boards/:boardId/assets (editor only). */
export function assetsUploadRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db
  const dir = deps.env.ASSET_DIR

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: 'file too large' }, 413)
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const mime = sniffImageMime(buf.subarray(0, 16))
    if (!mime || !allowed.includes(mime)) {
      return c.json({ error: 'unsupported image type' }, 415)
    }
    const id = randomUUID()
    const originalPath = await writeOriginal(dir, id, mime, buf)
    const user = c.get('user') as SessionUser
    const rows = await db
      .insert(assets)
      .values({ id, boardId, originalPath, mime, sizeBytes: buf.length, createdBy: user.id })
      .returning({ id: assets.id, status: assets.processingStatus })
    return c.json(rows[0], 201)
  })

  r.post('/from-url', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = fromUrlSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid url' }, 400)
    }
    const id = randomUUID()
    const user = c.get('user') as SessionUser
    const rows = await db
      .insert(assets)
      .values({ id, boardId, sourceUrl: parsed.data.url, createdBy: user.id })
      .returning({ id: assets.id, status: assets.processingStatus })
    return c.json(rows[0], 201)
  })

  return r
}
