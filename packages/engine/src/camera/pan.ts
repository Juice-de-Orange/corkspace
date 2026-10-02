import type { Camera } from '@corkspace/shared/kernel'

export type PanDirection = 'up' | 'down' | 'left' | 'right'

/** Pan by a screen-pixel delta (e.g. a pointer drag of empty space). */
export const panByScreen = (c: Camera, dxScreen: number, dyScreen: number): Camera => ({
  ...c,
  x: c.x + dxScreen,
  y: c.y + dyScreen,
})

/** Pan so the world content shifts by (dxWorld, dyWorld) on screen. */
export const panByWorld = (c: Camera, dxWorld: number, dyWorld: number): Camera => ({
  ...c,
  x: c.x - dxWorld * c.zoom,
  y: c.y - dyWorld * c.zoom,
})

/** Scroll the viewport one step in a direction (content shifts the opposite way). */
export function arrowKeyPan(c: Camera, dir: PanDirection, stepScreen = 80): Camera {
  switch (dir) {
    case 'up':
      return panByScreen(c, 0, stepScreen)
    case 'down':
      return panByScreen(c, 0, -stepScreen)
    case 'left':
      return panByScreen(c, stepScreen, 0)
    case 'right':
      return panByScreen(c, -stepScreen, 0)
  }
}
