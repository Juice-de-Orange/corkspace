import { screenToWorld } from '@corkspace/engine'
import { type CreateEntryInput, screenPoint } from '@corkspace/shared'
import { apiAssetFromUrl, apiUploadAsset, waitForAsset } from '../api/assets'
import { cameraAtom, viewportAtom } from '../canvas/state/camera-store'
import { entriesAtom } from '../canvas/state/entry-store'
import { history } from '../history/history'
import { createEntryCommand } from './entry-commands'

const ON_SCREEN_LONG_EDGE = 320 // px

function nextZIndex(): number {
  let max = 0
  for (const e of entriesAtom.value.values()) {
    max = Math.max(max, e.zIndex)
  }
  return max + 1
}

function imageEntryInput(
  assetId: string,
  naturalW: number,
  naturalH: number,
  atScreen?: { x: number; y: number },
): CreateEntryInput {
  const cam = cameraAtom.value
  const vp = viewportAtom.value
  const screen = atScreen ?? { x: vp.w / 2, y: vp.h / 2 }
  const center = screenToWorld(screenPoint(screen.x, screen.y), cam)
  const long = ON_SCREEN_LONG_EDGE / cam.zoom
  const ar = naturalW / Math.max(1, naturalH)
  const w = ar >= 1 ? long : long * ar
  const h = ar >= 1 ? long / ar : long
  return {
    type: 'image',
    x: center.x - w / 2,
    y: center.y - h / 2,
    width: w,
    height: h,
    rotation: 0,
    zIndex: nextZIndex(),
    visibility: 'private',
    imageAssetId: assetId,
    content: {},
  }
}

export async function createImageFromFile(
  file: File,
  atScreen?: { x: number; y: number },
): Promise<void> {
  const { id } = await apiUploadAsset(file)
  const status = await waitForAsset(id)
  if (status.status !== 'ready') {
    throw new Error('image processing failed')
  }
  await history.execute(
    createEntryCommand(imageEntryInput(id, status.width ?? 320, status.height ?? 240, atScreen)),
  )
}

/**
 * Create an image entry from a remote URL (SSRF-safe server download → sharp variants).
 * Implemented end-to-end but not yet surfaced in the UI — the create flow is wired in Phase 4
 * (mobile/chrome). See docs/adr/.
 * @public
 */
export async function createImageFromUrl(
  url: string,
  atScreen?: { x: number; y: number },
): Promise<void> {
  const { id } = await apiAssetFromUrl(url)
  const status = await waitForAsset(id)
  if (status.status !== 'ready') {
    throw new Error('image download/processing failed')
  }
  await history.execute(
    createEntryCommand(imageEntryInput(id, status.width ?? 320, status.height ?? 240, atScreen)),
  )
}
