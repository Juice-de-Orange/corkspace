import {
  arrowKeyPan,
  type PanDirection,
  panByScreen,
  screenToWorld,
  wheelToZoom,
  zoomToCursor,
} from '@corkspace/engine'
import {
  type Camera,
  type ScreenSize,
  screenPoint,
  screenSize,
  type WorldPoint,
} from '@corkspace/shared/kernel'
import { atom } from 'signia'

/** The single source of truth for the camera. Pan/zoom write here; the world transform
 *  is applied imperatively per rAF (never via a React re-render of the entry tree). */
export const cameraAtom = atom<Camera>('camera', { x: 0, y: 0, zoom: 1 })
export const viewportAtom = atom<ScreenSize>('viewport', screenSize(0, 0))

export const getCamera = (): Camera => cameraAtom.value

export function setCamera(c: Camera): void {
  cameraAtom.set(c)
}

export function setViewport(w: number, h: number): void {
  viewportAtom.set(screenSize(w, h))
}

export function applyPan(dxScreen: number, dyScreen: number): void {
  cameraAtom.set(panByScreen(cameraAtom.value, dxScreen, dyScreen))
}

export function applyWheelZoom(cursorX: number, cursorY: number, deltaY: number): void {
  const c = cameraAtom.value
  cameraAtom.set(zoomToCursor(c, screenPoint(cursorX, cursorY), wheelToZoom(c.zoom, deltaY)))
}

export function applyArrowPan(dir: PanDirection): void {
  cameraAtom.set(arrowKeyPan(cameraAtom.value, dir))
}

/** Zoom to an explicit target factor about a screen anchor (used by pinch). */
export function applyZoomAround(anchorX: number, anchorY: number, nextZoom: number): void {
  cameraAtom.set(zoomToCursor(cameraAtom.value, screenPoint(anchorX, anchorY), nextZoom))
}

/** World point currently under a screen cursor position. */
export function screenToWorldAtCursor(cursorX: number, cursorY: number): WorldPoint {
  return screenToWorld(screenPoint(cursorX, cursorY), cameraAtom.value)
}
