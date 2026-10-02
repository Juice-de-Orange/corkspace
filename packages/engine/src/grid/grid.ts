import type { Camera } from '@corkspace/shared/kernel'
import { clamp01 } from '../flight/easing'

export interface GridStep {
  worldStep: number
  screenStep: number
  opacity: number
}

const mod = (a: number, n: number): number => ((a % n) + n) % n

/**
 * Pick a world grid step (power-of-two octaves of `baseWorld`) so the on-screen spacing
 * stays within a legible band across the whole zoom range (0.02×–8×).
 */
export function gridStep(zoom: number, baseWorld = 64, minScreen = 24, maxScreen = 96): GridStep {
  if (zoom <= 0) {
    throw new RangeError(`gridStep: zoom must be > 0 (got ${zoom})`)
  }
  let worldStep = baseWorld
  let screenStep = worldStep * zoom
  // Bounded: each iteration multiplies/divides by 2; the zoom range needs < 40 octaves.
  for (let i = 0; i < 64 && screenStep < minScreen; i++) {
    worldStep *= 2
    screenStep = worldStep * zoom
  }
  for (let i = 0; i < 64 && screenStep > maxScreen; i++) {
    worldStep /= 2
    screenStep = worldStep * zoom
  }
  const opacity = 0.25 + clamp01((screenStep - minScreen) / (maxScreen - minScreen)) * 0.35
  return { worldStep, screenStep, opacity }
}

/** One tiling dot layer: CSS background size/position (screen px) + opacity. */
export interface GridLayer {
  sizePx: number
  offsetXPx: number
  offsetYPx: number
  opacity: number
}

/** Two cross-faded octaves of the dot grid, aligned to the world origin. Rendered as two stacked
 *  layers so each PHYSICAL grid line's opacity stays continuous across an octave flip — no "pop". */
export interface GridBackground {
  fine: GridLayer
  coarse: GridLayer
}

/** smoothstep(0..1): eases the cross-fade so the transition has no visible kink. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t)

/**
 * CSS background params for an infinite dot grid. Instead of snapping to a single octave (which
 * jumps size AND opacity discontinuously at each boundary — the "flicker" when zooming), we render a
 * FINE octave `W` (chosen so its on-screen spacing sits in `[minScreen, 2·minScreen)`) and a COARSE
 * octave `2W`, cross-fading between them by the sub-octave phase. As the fine dots grow past
 * `2·minScreen` the octave halves and the layers swap roles at equal opacity → continuous.
 */
export function gridBackground(
  camera: Camera,
  baseWorld = 64,
  minScreen = 24,
  maxOpacity = 0.55,
): GridBackground {
  const { zoom } = camera
  if (zoom <= 0) {
    throw new RangeError(`gridBackground: zoom must be > 0 (got ${zoom})`)
  }
  // Fine octave W = baseWorld · 2^k with on-screen spacing sf = W·zoom ∈ [minScreen, 2·minScreen).
  let w = baseWorld
  let sf = w * zoom
  for (let i = 0; i < 64 && sf < minScreen; i++) {
    w *= 2
    sf = w * zoom
  }
  for (let i = 0; i < 64 && sf >= 2 * minScreen; i++) {
    w /= 2
    sf = w * zoom
  }
  const sc = sf * 2 // coarse octave spacing (screen px)
  const s = smoothstep((sf - minScreen) / minScreen) // phase within the octave, in [0,1)
  return {
    fine: {
      sizePx: sf,
      offsetXPx: mod(camera.x, sf),
      offsetYPx: mod(camera.y, sf),
      opacity: maxOpacity * s,
    },
    coarse: {
      sizePx: sc,
      offsetXPx: mod(camera.x, sc),
      offsetYPx: mod(camera.y, sc),
      opacity: maxOpacity * (1 - s),
    },
  }
}
