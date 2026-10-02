import { useEffect, useState } from 'react'
import { useValue } from 'signia-react'
import { deleteConnectionCommand, patchConnectionCommand } from '../../commands/connection-commands'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { boardAccessAtom } from '../state/board-store'
import { connectionsAtom, selectedConnectionIdAtom } from '../state/connection-store'

const CONN_COLORS = ['#dc2626', '#6050dc', '#16a34a', '#f59e0b', '#1a1a1a']

type Patch = { color?: string; label?: string | null; arrowStart?: boolean; arrowEnd?: boolean }

/** Inline editor for the selected connection: label, arrowheads, colour, delete. */
export function ConnectionEditor() {
  const access = useValue(boardAccessAtom)
  const selectedId = useValue(selectedConnectionIdAtom)
  const conns = useValue(connectionsAtom)
  const conn = selectedId ? conns.get(selectedId) : undefined
  const [label, setLabel] = useState('')
  const t = useT()

  useEffect(() => {
    setLabel(conn?.label ?? '')
  }, [conn?.label])

  if (!access?.canEdit || !conn) {
    return null
  }

  const patch = (p: Patch): void => void history.execute(patchConnectionCommand(conn, p))
  const close = (): void => {
    selectedConnectionIdAtom.set(null)
  }
  const commitLabel = (): void => {
    const v = label.trim()
    if (v !== (conn.label ?? '')) {
      patch({ label: v || null })
    }
  }

  return (
    <div
      className="panel"
      data-no-pan
      data-export-ignore
      data-connection-editor
      data-ui-chrome
      style={{
        position: 'absolute',
        left: '50%',
        top: 8,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        zIndex: 2_100_000,
      }}
    >
      <input
        data-conn-label
        value={label}
        placeholder={t('canvas.labelPlaceholder')}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitLabel()
            e.currentTarget.blur()
          }
        }}
        style={{
          font: 'inherit',
          fontSize: 13,
          padding: '4px 8px',
          borderRadius: 8,
          border: '1px solid var(--panel-border)',
          background: 'var(--app-bg)',
          color: 'var(--app-text)',
          width: 150,
        }}
      />
      <button
        type="button"
        aria-label={t('canvas.arrowStart')}
        data-conn-arrow-start
        className={conn.arrowStart ? 'btn btn-sm is-active' : 'btn btn-sm btn-ghost'}
        onClick={() => patch({ arrowStart: !conn.arrowStart })}
      >
        ←
      </button>
      <button
        type="button"
        aria-label={t('canvas.arrowEnd')}
        data-conn-arrow-end
        className={conn.arrowEnd ? 'btn btn-sm is-active' : 'btn btn-sm btn-ghost'}
        onClick={() => patch({ arrowEnd: !conn.arrowEnd })}
      >
        →
      </button>
      <div style={{ display: 'flex', gap: 4 }}>
        {CONN_COLORS.map((col) => (
          <button
            key={col}
            type="button"
            aria-label={t('canvas.color', { col })}
            data-conn-color={col}
            onClick={() => patch({ color: col })}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: col,
              border: conn.color === col ? '2px solid var(--panel-text)' : '2px solid #fff',
              boxShadow: '0 0 0 1px var(--panel-border)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={t('canvas.deleteConnection')}
        data-conn-delete
        className="btn btn-sm btn-ghost"
        onClick={() => {
          void history.execute(deleteConnectionCommand(conn))
          close()
        }}
        style={{ color: '#dc2626' }}
      >
        🗑
      </button>
      <button
        type="button"
        aria-label={t('canvas.close')}
        onClick={close}
        className="btn btn-ghost btn-icon"
        style={{ width: 24, height: 24, padding: 0 }}
      >
        ×
      </button>
    </div>
  )
}
