import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import { computed } from 'signia'
import { useValue } from 'signia-react'
import { apiGetContent } from '../../api/entries'
import { updateEntryContentCommand } from '../../commands/entry-commands'
import { history } from '../../history/history'
import { useT } from '../../i18n'
import { editingEntryIdAtom, setEditing } from '../state/editor-state'
import { type EntryMeta, entryContentRevAtom, recentlyCreatedIds } from '../state/entry-store'

const STICKY_BG: Record<string, string> = {
  yellow: '#fde68a',
  pink: '#fbcfe8',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  orange: '#fed7aa',
  purple: '#ddd6fe',
}

function stickyText(content: unknown): string {
  if (content && typeof content === 'object') {
    const t = (content as { text?: unknown }).text
    if (typeof t === 'string') {
      return t
    }
  }
  return ''
}

/**
 * Module-level cache of the last-known text per sticky id (+ the content revision it was fetched at).
 * A sticky unmounts and remounts whenever it crosses the LOD block↔full boundary while zooming;
 * seeding state from this cache makes the remount show its text INSTANTLY (no fetch, no blank flash).
 * A newer revision (version restore) bypasses the cache and refetches. Survives remounts by design.
 */
const stickyTextCache = new Map<string, { rev: number; text: string }>()

/** Sticky note: lazy-loads its text, renders it, and edits in place on double-click
 *  (save-on-blur via the command stack). */
export function StickyEntry({
  meta,
  innerRef,
}: {
  meta: EntryMeta
  innerRef: Ref<HTMLDivElement>
}) {
  const editing = useValue(editingEntryIdAtom) === meta.id
  const t = useT()
  // Seed synchronously from the cache so an LOD remount shows text immediately (no flash).
  const cached = stickyTextCache.get(meta.id)
  const [text, setText] = useState(cached?.text ?? '')
  const [loaded, setLoaded] = useState(
    () => cached !== undefined || recentlyCreatedIds.has(meta.id),
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Refs mirror the latest values for the load guard + unmount-safety commit (no stale closures).
  const editingRef = useRef(editing)
  editingRef.current = editing
  const textRef = useRef(text)
  textRef.current = text
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  const contentRev = useValue(
    useMemo(
      () => computed(`contentRev:${meta.id}`, () => entryContentRevAtom.value.get(meta.id) ?? 0),
      [meta.id],
    ),
  )

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    // Cache hit at the current revision → no fetch, no flash (LOD remount fast path).
    const hit = stickyTextCache.get(meta.id)
    if (hit && hit.rev === contentRev) {
      if (!editingRef.current) {
        setText(hit.text)
      }
      setLoaded(true)
      return
    }
    let cancelled = false
    void apiGetContent(meta.id, contentRev)
      .then((c) => {
        if (cancelled) {
          return
        }
        const t = stickyText(c)
        stickyTextCache.set(meta.id, { rev: contentRev, text: t })
        // Never clobber an in-progress edit if a (re)fetch resolves late.
        if (!editingRef.current) {
          setText(t)
        }
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meta.id, contentRev])

  // Safety: if this sticky unmounts while being edited (e.g. panned out of view), persist the draft.
  useEffect(() => {
    return () => {
      if (editingRef.current && loadedRef.current) {
        const val = textareaRef.current?.value
        if (typeof val === 'string' && val !== textRef.current) {
          // Committed on unmount at a possibly-stale revision → drop the cache so the next mount
          // refetches the authoritative content rather than showing a stale line.
          stickyTextCache.delete(meta.id)
          void history.execute(
            updateEntryContentCommand(meta.id, { text: textRef.current }, { text: val }),
          )
        }
      }
    }
  }, [meta.id])

  function commit(value: string): void {
    setEditing(null)
    // Content-wipe guard: never persist before the real content has loaded.
    if (!loadedRef.current) {
      return
    }
    if (value !== text) {
      const prev = { text }
      setText(value)
      stickyTextCache.set(meta.id, { rev: contentRev, text: value }) // keep the cache fresh
      void history.execute(updateEntryContentCommand(meta.id, prev, { text: value }))
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas entry; full a11y in Phase 6
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry entry-sticky"
      onDoubleClick={() => loaded && setEditing(meta.id)}
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        background: STICKY_BG[meta.color ?? 'yellow'] ?? '#fde68a',
        padding: '32px 14px 14px',
        boxSizing: 'border-box',
        fontFamily: 'var(--sticky-font, Caveat, ui-sans-serif, system-ui)',
        fontSize: 'var(--sticky-fs, 60px)',
        lineHeight: 1.12,
        overflow: 'hidden',
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          data-no-pan
          defaultValue={text}
          onBlur={(e) => commit(e.target.value)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            font: 'inherit',
          }}
        />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text || <span style={{ opacity: 0.4 }}>{t('canvas.doubleClickToEdit')}</span>}
        </div>
      )}
    </div>
  )
}
