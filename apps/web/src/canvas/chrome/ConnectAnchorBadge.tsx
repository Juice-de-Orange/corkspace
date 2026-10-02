import { worldToScreen } from '@corkspace/engine'
import { worldPoint } from '@corkspace/shared'
import { useEffect, useRef } from 'react'
import { react } from 'signia'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { cameraAtom } from '../state/camera-store'
import { connectAnchorAtom, connectToolAtom } from '../state/connection-store'

/** Screen-space docking badge for the Verbinden tool: a small accent dot pinned to the nearest
 *  edge point of the hovered entry, showing where the thread will attach. Follows the camera
 *  IMPERATIVELY (re-projects the stored world point each frame) so it never drifts on pan/zoom. */
export function ConnectAnchorBadge() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const frame = (): void => {
      const anchor = connectAnchorAtom.value
      if (!connectToolAtom.value || !anchor) {
        el.style.display = 'none'
        return
      }
      const s = worldToScreen(worldPoint(anchor.wx, anchor.wy), cameraAtom.value)
      el.style.display = 'block'
      el.style.left = `${s.x}px`
      el.style.top = `${s.y}px`
    }
    return react('connect-anchor-badge', () => {
      depend(cameraAtom)
      depend(connectAnchorAtom)
      depend(connectToolAtom)
      scheduleFrame(frame)
    })
  }, [])

  return (
    <div
      ref={ref}
      data-connect-anchor
      style={{
        display: 'none',
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--accent)',
        border: '2.5px solid #fff',
        boxShadow: '0 1px 5px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
      }}
    />
  )
}
