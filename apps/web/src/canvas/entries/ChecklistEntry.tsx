import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import { computed } from 'signia'
import { useValue } from 'signia-react'
import { apiGetContent } from '../../api/entries'
import { updateEntryContentCommand } from '../../commands/entry-commands'
import { IconButton } from '../../components/ui'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { type EntryMeta, entryContentRevAtom, recentlyCreatedIds } from '../state/entry-store'

interface Item {
  id: string
  text: string
  checked: boolean
}

function readItems(content: unknown): Item[] {
  if (
    content &&
    typeof content === 'object' &&
    Array.isArray((content as { items?: unknown }).items)
  ) {
    return ((content as { items: unknown[] }).items as Item[]).filter(
      (i) => i && typeof i.id === 'string',
    )
  }
  return []
}

/** Checklist entry: structured `{items}` (not a TipTap task list). Toggle/add persist
 *  immediately; item text persists on blur. */
export function ChecklistEntry({
  meta,
  innerRef,
}: {
  meta: EntryMeta
  innerRef: Ref<HTMLDivElement>
}) {
  const [items, setItems] = useState<Item[]>([])
  const t = useT()
  const [loaded, setLoaded] = useState(() => recentlyCreatedIds.has(meta.id))
  const itemsRef = useRef(items)
  itemsRef.current = items
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  // Monotonic local-edit counter. Every save bumps contentRev → this component refetches; under load
  // that refetch can resolve AFTER a newer optimistic edit and clobber it (e.g. a checkbox toggle
  // snaps back). Fetches that started before a local edit are discarded via this generation guard.
  const editGenRef = useRef(0)
  /** Apply a local optimistic edit and mark it so an in-flight refetch can't overwrite it. */
  const applyLocal = (next: Item[]): void => {
    editGenRef.current++
    setItems(next)
  }
  const contentRev = useValue(
    useMemo(
      () => computed(`contentRev:${meta.id}`, () => entryContentRevAtom.value.get(meta.id) ?? 0),
      [meta.id],
    ),
  )

  useEffect(() => {
    let cancelled = false
    const gen = editGenRef.current
    void apiGetContent(meta.id, contentRev)
      .then((c) => {
        if (cancelled) {
          return
        }
        // Only adopt the server content if no local edit happened while this fetch was in flight.
        if (editGenRef.current === gen) {
          setItems(readItems(c))
        }
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meta.id, contentRev])

  // Route through the command stack: undoable, version-captured, coalesced, and rev-bumped so
  // undo/redo is visible. Guard against persisting before the real content has loaded (wipe race).
  function persist(next: Item[]): void {
    if (!loadedRef.current) {
      return
    }
    const prev = itemsRef.current
    applyLocal(next)
    void history.execute(updateEntryContentCommand(meta.id, { items: prev }, { items: next }))
  }

  return (
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry entry-checklist"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'auto',
        fontSize: 'var(--checklist-fs, 28px)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('canvas.checklist')}</div>
      {items.map((item) => (
        <div
          key={item.id}
          data-no-pan
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() =>
                persist(items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)))
              }
            />
            <input
              value={item.text}
              placeholder="…"
              onChange={(e) => {
                editGenRef.current++
                setItems((cur) =>
                  cur.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
                )
              }}
              onBlur={() => persist(items)}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                font: 'inherit',
                textDecoration: item.checked ? 'line-through' : 'none',
                color: item.checked ? '#999' : 'inherit',
              }}
            />
          </label>
          <IconButton
            label={t('canvas.removeItem')}
            size="sm"
            variant="bare"
            data-no-pan
            onClick={() => persist(items.filter((i) => i.id !== item.id))}
          >
            ✕
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        data-no-pan
        onClick={() => persist([...items, { id: crypto.randomUUID(), text: '', checked: false }])}
        style={{ marginTop: 6, fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}
      >
        + {t('canvas.addItem')}
      </button>
    </div>
  )
}
