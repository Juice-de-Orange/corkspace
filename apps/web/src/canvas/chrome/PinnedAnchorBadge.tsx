import { worldToScreen } from '@corkspace/engine'
import { worldPoint } from '@corkspace/shared'
import { useEffect, useRef } from 'react'
import { react } from 'signia'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { cameraAtom } from '../state/camera-store'
import { connectSourceAnchorAtom } from '../state/connection-store'

/** The DOCKED end of an in-progress Verbinden gesture: a screen-sized accent dot pinned to the
 *  world point picked with the first click. Follows the camera imperatively (no React re-render
 *  on pan/zoom); hidden while nothing is docked; never intercepts input. */
export function PinnedAnchorBadge() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const frame = (): void => {
      const a = connectSourceAnchorAtom.value
      if (!a) {
        el.style.display = 'none'
        return
      }
      const s = worldToScreen(worldPoint(a.wx, a.wy), cameraAtom.value)
      el.style.display = 'block'
      el.style.left = `${s.x}px`
      el.style.top = `${s.y}px`
    }
    return react('pinned-anchor-badge', () => {
      depend(cameraAtom)
      depend(connectSourceAnchorAtom)
      scheduleFrame(frame)
    })
  }, [])

  return (
    <div
      ref={ref}
      data-connect-source-anchor
      style={{
        display: 'none',
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'var(--accent)',
        border: '3px solid #fff',
        boxShadow: '0 0 0 3px var(--accent-ring), 0 1px 5px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
      }}
    />
  )
}
