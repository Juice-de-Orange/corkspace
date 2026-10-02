import { type GridLayer, gridBackground } from '@corkspace/engine'
import { useEffect, useRef } from 'react'
import { react } from 'signia'
import { interactingAtom } from '../runtime/gesture-state'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { cameraAtom } from '../state/camera-store'

/** Cork pinboard surface (opaque, textured via CSS) with a dotted grid that scales with zoom and
 *  stays aligned to the world origin. Two cross-faded octave layers (fine + coarse) keep the dots
 *  continuous across octave boundaries — no "pop". Only the inner grid layers are updated
 *  imperatively per rAF (no React re-render on camera move); the cork itself never fades. */
export function BackgroundGrid() {
  const fineRef = useRef<HTMLDivElement>(null)
  const coarseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const writeLayer = (el: HTMLDivElement | null, layer: GridLayer): void => {
      if (!el) {
        return
      }
      el.style.backgroundSize = `${layer.sizePx}px ${layer.sizePx}px`
      el.style.backgroundPosition = `${layer.offsetXPx}px ${layer.offsetYPx}px`
      el.style.opacity = String(layer.opacity)
    }
    const frame = (): void => {
      const c = cameraAtom.value
      // Match the world transform: raw camera coords DURING a gesture (smooth, in lockstep with the
      // world), device-pixel-snapped when idle (dots stay pixel-locked to content, crisp).
      const dpr = window.devicePixelRatio || 1
      const snap = !interactingAtom.value
      const x = snap ? Math.round(c.x * dpr) / dpr : c.x
      const y = snap ? Math.round(c.y * dpr) / dpr : c.y
      const bg = gridBackground({ x, y, zoom: c.zoom })
      writeLayer(fineRef.current, bg.fine)
      writeLayer(coarseRef.current, bg.coarse)
    }
    return react('background-grid', () => {
      depend(cameraAtom)
      depend(interactingAtom)
      scheduleFrame(frame)
    })
  }, [])

  return (
    <div aria-hidden className="canvas-bg">
      <div ref={coarseRef} className="grid-dots grid-dots-coarse" />
      <div ref={fineRef} className="grid-dots grid-dots-fine" />
    </div>
  )
}
