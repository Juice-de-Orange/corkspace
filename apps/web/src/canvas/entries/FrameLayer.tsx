import type { PointerEvent as ReactPointerEvent } from 'react'
import { useValue } from 'signia-react'
import { deleteFrameCommand, moveFrameCommand } from '../../commands/frame-commands'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { sc } from '../lib/screen-scale'
import { boardAccessAtom, canEdit } from '../state/board-store'
import { getCamera } from '../state/camera-store'
import { type FrameMeta, framesAtom, upsertFrame } from '../state/frame-store'

function FrameView({ frame, admin }: { frame: FrameMeta; admin: boolean }) {
  const t = useT()
  const onHeaderDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!canEdit()) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // synthetic pointers may reject capture
    }
    const zoom = getCamera().zoom
    const px = e.clientX
    const py = e.clientY
    const el = document.querySelector<HTMLElement>(`[data-frame-id="${frame.id}"]`)
    const move = (ev: PointerEvent): void => {
      if (el) {
        el.style.left = `${frame.x + (ev.clientX - px) / zoom}px`
        el.style.top = `${frame.y + (ev.clientY - py) / zoom}px`
      }
    }
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dx = (ev.clientX - px) / zoom
      const dy = (ev.clientY - py) / zoom
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        return
      }
      upsertFrame({ ...frame, x: frame.x + dx, y: frame.y + dy }) // optimistic; command reloads
      void history.execute(moveFrameCommand(frame, dx, dy))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const accent = frame.color ?? 'rgba(96,80,220,0.85)'
  // Screen-constant length inside the scaled world (--px = 1/zoom on the world container).
  return (
    <div
      data-frame-id={frame.id}
      className="entry-frame"
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        border: `${sc(2)} dashed ${frame.color ?? 'rgba(96,80,220,0.5)'}`,
        borderRadius: sc(8),
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-no-pan
        data-frame-header={frame.id}
        onPointerDown={onHeaderDown}
        style={{
          position: 'absolute',
          left: 0,
          top: sc(-22),
          height: sc(20),
          padding: `0 ${sc(8)}`,
          background: accent,
          color: '#fff',
          borderRadius: sc(6),
          fontSize: sc(12),
          lineHeight: sc(20),
          pointerEvents: 'auto',
          cursor: admin ? 'move' : 'default',
          display: 'flex',
          gap: sc(8),
          alignItems: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        <span>▢ {frame.name}</span>
        {admin && (
          <button
            type="button"
            data-no-pan
            title={t('canvas.deleteFrame')}
            onClick={() => void history.execute(deleteFrameCommand(frame))}
            style={{ color: '#fff', fontSize: sc(12), lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

/** Named frames (loose grouping). Rendered behind entries; dragging the header moves the frame
 *  and its contained entries (server-side atomic group-move). */
export function FrameLayer() {
  const frames = useValue(framesAtom)
  const admin = useValue(boardAccessAtom)?.canEdit ?? false
  return (
    <>
      {[...frames.values()].map((f) => (
        <FrameView key={f.id} frame={f} admin={admin} />
      ))}
    </>
  )
}
