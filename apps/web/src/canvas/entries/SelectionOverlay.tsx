import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef } from 'react'
import { useValue } from 'signia-react'
import {
  deleteEntryCommand,
  resizeEntryCommand,
  setVisibilityCommand,
  setZIndexCommand,
} from '../../commands/entry-commands'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { sc, scv } from '../lib/screen-scale'
import { boardAccessAtom } from '../state/board-store'
import { getCamera } from '../state/camera-store'
import { setEditing } from '../state/editor-state'
import { type EntryMeta, entriesAtom } from '../state/entry-store'
import { selectedEntryIdAtom } from '../state/selection-state'

const MIN_ENTRY_SIZE = 60 // px, world units — smallest an entry can be resized to

/** Screen-constant selection badge button (grows on touch via --sel-badge-h). */
function badgeStyle(borderColor: string): CSSProperties {
  return {
    height: scv('--sel-badge-h'),
    minWidth: scv('--sel-badge-h'),
    padding: `0 ${sc(5)}`,
    fontSize: sc(12),
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    color: '#111',
    border: `${sc(1.5)} solid ${borderColor}`,
    borderRadius: sc(9),
    pointerEvents: 'auto',
    cursor: 'pointer',
  }
}

function SelectionBox({ meta }: { meta: EntryMeta }) {
  const boxRef = useRef<HTMLDivElement>(null)
  // Only text entries have an editor; the ✏️ affordance is the touch path (double-click on desktop).
  const editable = meta.type === 'sticky' || meta.type === 'doc'
  const t = useT()

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // synthetic pointers (tests) may reject capture; window listeners cover the drag anyway
    }
    const zoom = getCamera().zoom
    const startW = meta.w
    const startH = meta.h
    const px = e.clientX
    const py = e.clientY
    const entryEl = document.querySelector<HTMLElement>(`[data-entry-id="${meta.id}"]`)

    const sizeAt = (ev: PointerEvent) => ({
      w: Math.max(MIN_ENTRY_SIZE, startW + (ev.clientX - px) / zoom),
      h: Math.max(MIN_ENTRY_SIZE, startH + (ev.clientY - py) / zoom),
    })
    const move = (ev: PointerEvent): void => {
      const { w, h } = sizeAt(ev)
      if (entryEl) {
        entryEl.style.width = `${w}px`
        entryEl.style.height = `${h}px`
      }
      if (boxRef.current) {
        boxRef.current.style.width = `${w}px`
        boxRef.current.style.height = `${h}px`
      }
    }
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (handle.hasPointerCapture(ev.pointerId)) {
        handle.releasePointerCapture(ev.pointerId)
      }
      const { w, h } = sizeAt(ev)
      void history.execute(resizeEntryCommand(meta, { w: startW, h: startH }, { w, h }))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Screen-constant length: `calc(Npx * var(--px))` renders at N screen px inside the scaled world.
  return (
    <div
      ref={boxRef}
      className="selection-box"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        border: `${sc(2)} solid var(--accent)`,
        borderRadius: sc(8),
        boxShadow: `0 0 0 ${sc(3)} var(--accent-ring)`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 2_000_000,
      }}
    >
      <div
        data-no-pan
        data-resize-handle
        onPointerDown={onHandleDown}
        style={{
          position: 'absolute',
          right: `calc(${scv('--sel-hit')} / -2)`,
          bottom: `calc(${scv('--sel-hit')} / -2)`,
          width: scv('--sel-hit'),
          height: scv('--sel-hit'),
          background: 'var(--accent)',
          border: `${sc(2)} solid #fff`,
          borderRadius: sc(3),
          pointerEvents: 'auto',
          cursor: 'nwse-resize',
        }}
      />
      {/* Action badges: an auto-spacing row above the entry (so touch-enlarged buttons never
          overlap). Rotates with the selection box. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: '100%',
          marginBottom: sc(6),
          display: 'flex',
          gap: sc(3),
          pointerEvents: 'none',
        }}
      >
        {editable && (
          <button
            type="button"
            data-no-pan
            data-edit-entry
            title={t('canvas.edit')}
            aria-label={t('canvas.edit')}
            onClick={() => setEditing(meta.id)}
            style={badgeStyle('var(--accent)')}
          >
            ✏️
          </button>
        )}
        <button
          type="button"
          data-no-pan
          data-visibility-toggle
          title={t(
            meta.visibility === 'public' ? 'canvas.visibilityPublic' : 'canvas.visibilityPrivate',
          )}
          onClick={() =>
            void history.execute(
              setVisibilityCommand(meta, meta.visibility === 'public' ? 'private' : 'public'),
            )
          }
          style={badgeStyle('var(--accent)')}
        >
          {meta.visibility === 'public' ? '🌐' : '🔒'}
        </button>
        <button
          type="button"
          data-no-pan
          data-delete-entry
          title={t('canvas.moveToTrash')}
          aria-label={t('canvas.moveToTrash')}
          onClick={() => void history.execute(deleteEntryCommand(meta))}
          style={badgeStyle('var(--danger)')}
        >
          🗑
        </button>
        <button
          type="button"
          data-no-pan
          data-bring-front
          title={t('canvas.bringToFront')}
          aria-label={t('canvas.bringToFront')}
          onClick={() => {
            let max = meta.zIndex
            for (const e of entriesAtom.value.values()) {
              max = Math.max(max, e.zIndex)
            }
            void history.execute(setZIndexCommand(meta, max + 1))
          }}
          style={badgeStyle('var(--accent)')}
        >
          ⬆
        </button>
        <button
          type="button"
          data-no-pan
          data-send-back
          title={t('canvas.sendToBack')}
          aria-label={t('canvas.sendToBack')}
          onClick={() => {
            let min = meta.zIndex
            for (const e of entriesAtom.value.values()) {
              min = Math.min(min, e.zIndex)
            }
            void history.execute(setZIndexCommand(meta, min - 1))
          }}
          style={badgeStyle('var(--accent)')}
        >
          ⬇
        </button>
      </div>
    </div>
  )
}

/** Selection outline + corner resize handle for the selected entry (lives in the world container). */
export function SelectionOverlay() {
  const access = useValue(boardAccessAtom)
  const selectedId = useValue(selectedEntryIdAtom)
  const entries = useValue(entriesAtom)
  // Read-only mode (viewer / external link): no selection handles (resize / visibility).
  if (!access?.canEdit) {
    return null
  }
  const meta = selectedId ? entries.get(selectedId) : undefined
  return meta ? <SelectionBox meta={meta} /> : null
}
