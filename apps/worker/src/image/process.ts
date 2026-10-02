import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Database } from '@corkspace/db'
import { assets } from '@corkspace/db/schema'
import { IMAGE_LONG_EDGE_CAP, sniffImageMime } from '@corkspace/shared'
import { safeFetch } from '@corkspace/shared/server'
import { eq } from 'drizzle-orm'
import sharp, { type SharpOptions } from 'sharp'

const SCALES = [64, 128, 256, 512]
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

/** Generate webp variants for one asset: download (SSRF-safe) or read the original, then
 *  produce a capped "full" + power-of-two widths, and mark the row ready. */
export async function processAsset(db: Database, assetDir: string, id: string): Promise<void> {
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  const asset = rows[0]
  if (!asset) {
    return
  }

  let input: Buffer
  if (asset.sourceUrl) {
    const res = await safeFetch(asset.sourceUrl, {
      allowedContentTypes: ['image/'],
      maxBytes: MAX_DOWNLOAD_BYTES,
    })
    input = res.body
  } else if (asset.originalPath) {
    input = await readFile(path.join(assetDir, asset.originalPath))
  } else {
    throw new Error('asset has no source')
  }

  // Animated GIFs must be decoded with { animated: true } so every frame is read and the
  // webp output keeps its animation. Detect via the stored mime or by sniffing the bytes.
  const isGif = asset.mime === 'image/gif' || sniffImageMime(input) === 'image/gif'
  const sharpOptions: SharpOptions | undefined = isGif ? { animated: true } : undefined

  const meta = await sharp(input, sharpOptions).metadata()
  if (!meta.width || !meta.height) {
    throw new Error('not a decodable image')
  }
  // For animated inputs sharp stacks the frames: `height` is pageHeight × pages. Store the
  // single-frame dimensions (pageHeight) so the entry sizes to the visible picture, not the strip.
  const frameWidth = meta.width
  const frameHeight = isGif && meta.pageHeight ? meta.pageHeight : meta.height
  const longEdge = Math.max(frameWidth, frameHeight)

  await mkdir(path.join(assetDir, id), { recursive: true })
  const variants: Record<string, string> = {}

  const fullRel = `${id}/full.webp`
  await sharp(input, sharpOptions)
    .resize(IMAGE_LONG_EDGE_CAP, IMAGE_LONG_EDGE_CAP, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toFile(path.join(assetDir, fullRel))
  variants.full = fullRel

  for (const s of SCALES) {
    if (s >= longEdge) {
      continue
    }
    const rel = `${id}/v${s}.webp`
    await sharp(input, sharpOptions)
      .resize(s, s, { fit: 'inside', withoutEnlargement: true })
      .webp()
      .toFile(path.join(assetDir, rel))
    variants[String(s)] = rel
  }

  await db
    .update(assets)
    .set({ processingStatus: 'ready', width: frameWidth, height: frameHeight, variants })
    .where(eq(assets.id, id))
}
