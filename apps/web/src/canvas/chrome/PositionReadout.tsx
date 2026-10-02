import { screenToWorld } from '@corkspace/engine'
import { screenPoint } from '@corkspace/shared/kernel'
import { useEffect, useRef } from 'react'
import { react } from 'signia'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { cameraAtom, viewportAtom } from '../state/camera-store'

/** Dezent corner readout of the world position at the viewport center + zoom %. */
export function PositionReadout() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const frame = (): void => {
      const c = cameraAtom.value
      const vp = viewportAtom.value
      const center = screenToWorld(screenPoint(vp.w / 2, vp.h / 2), c)
      el.textContent = `x ${Math.round(center.x)} · y ${Math.round(center.y)} · ${Math.round(c.zoom * 100)}%`
    }
    return react('position-readout', () => {
      depend(cameraAtom)
      depend(viewportAtom)
      scheduleFrame(frame)
    })
  }, [])

  return (
    <div
      ref={ref}
      data-export-ignore
      data-ui-chrome
      className="position-readout panel"
      style={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        fontSize: 11,
        color: 'var(--panel-muted)',
        padding: '3px 8px',
        borderRadius: 8,
        pointerEvents: 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  )
}
