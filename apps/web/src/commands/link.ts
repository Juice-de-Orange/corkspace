import { screenToWorld, worldSizeForNewEntry } from '@corkspace/engine'
import {
  type CreateEntryInput,
  type LinkPreview,
  REFERENCE_SIZES,
  screenPoint,
  screenSize,
} from '@corkspace/shared'
import { apiAssetFromUrl, waitForAsset } from '../api/assets'
import { apiLinkPreview } from '../api/links'
import { cameraAtom, viewportAtom } from '../canvas/state/camera-store'
import { entriesAtom } from '../canvas/state/entry-store'
import { history } from '../history/history'
import { createEntryCommand } from './entry-commands'

function nextZIndex(): number {
  let max = 0
  for (const e of entriesAtom.value.values()) {
    max = Math.max(max, e.zIndex)
  }
  return max + 1
}

export async function createLinkFromUrl(url: string): Promise<void> {
  let preview: LinkPreview
  try {
    preview = await apiLinkPreview(url)
  } catch {
    preview = { url }
  }

  const content: Record<string, unknown> = { url: preview.url }
  if (preview.title) content.title = preview.title
  if (preview.description) content.description = preview.description
  if (preview.siteName) content.siteName = preview.siteName

  // Localize the OpenGraph image via the SSRF-safe from-url asset pipeline (server download →
  // sharp webp → served same-origin at /api/assets/:id) and reference it by `imageAssetId`, so
  // the card never hotlinks a third-party host and the CSP can forbid remote images
  // (`img-src 'self' data:`). A blocked/failed/non-image URL simply yields a card with no
  // picture — never a broken remote hotlink. Done before placement so the card lands at the
  // viewport centre at creation time (localization can take ~1s).
  let imageAssetId: string | undefined
  if (preview.image) {
    try {
      const { id } = await apiAssetFromUrl(preview.image)
      const status = await waitForAsset(id)
      if (status.status === 'ready') imageAssetId = id
    } catch {
      // degrade to an image-less card
    }
  }

  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
  const ref = REFERENCE_SIZES.link
  const size = worldSizeForNewEntry(screenSize(ref.w, ref.h), cam.zoom)

  const input: CreateEntryInput = {
    type: 'link',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    width: size.w,
    height: size.h,
    rotation: 0,
    zIndex: nextZIndex(),
    visibility: 'private',
    content,
    ...(imageAssetId ? { imageAssetId } : {}),
  }
  await history.execute(createEntryCommand(input))
}

/** Create a video embed (a link entry; LinkCard renders YouTube/Vimeo URLs as a sandboxed iframe).
 *  Sized 16:9 + a drag bar. The URL is assumed already validated (YouTube/Vimeo). */
export async function createVideoFromUrl(url: string): Promise<void> {
  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), cam)
  const size = worldSizeForNewEntry(screenSize(400, 260), cam.zoom)
  const input: CreateEntryInput = {
    type: 'link',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    width: size.w,
    height: size.h,
    rotation: 0,
    zIndex: nextZIndex(),
    visibility: 'private',
    content: { url },
  }
  await history.execute(createEntryCommand(input))
}
