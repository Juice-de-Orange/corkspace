import { resolveEntryStyle } from '@corkspace/shared'
import { Fragment } from 'react'
import { useValue } from 'signia-react'
import type { Tag } from '../../api/tags'
import { sc } from '../lib/screen-scale'
import { entriesAtom } from '../state/entry-store'
import { tagsAtom } from '../state/tag-store'

/**
 * Renders tag chips above each tagged entry and applies a tag's rule-based styling (border /
 * emphasis) as a decoupled overlay box — so it never has to modify the per-type entry components
 * or fight the imperative collision outline. Lives in the world container (scales with the camera);
 * re-renders only when entries or tags change, never on pan/zoom.
 */
export function TagsLayer() {
  const entries = useValue(entriesAtom)
  const tags = useValue(tagsAtom)

  const items: {
    id: string
    x: number
    y: number
    w: number
    h: number
    rot: number
    tags: Tag[]
  }[] = []
  for (const meta of entries.values()) {
    if (!meta.tagIds || meta.tagIds.length === 0) {
      continue
    }
    const resolved = meta.tagIds.map((id) => tags.get(id)).filter((t): t is Tag => Boolean(t))
    if (resolved.length === 0) {
      continue
    }
    items.push({
      id: meta.id,
      x: meta.x,
      y: meta.y,
      w: meta.w,
      h: meta.h,
      rot: meta.rotation,
      tags: resolved,
    })
  }

  // Screen-constant length inside the scaled world (--px = 1/zoom, set on the world container).
  return (
    <div className="tags-layer" style={{ position: 'absolute', left: 0, top: 0 }}>
      {items.map((it) => {
        const style = resolveEntryStyle(it.tags.map((t) => t.styleRules))
        return (
          <Fragment key={it.id}>
            {style.borderColor && (
              <div
                data-tag-border={it.id}
                style={{
                  position: 'absolute',
                  left: it.x - 2,
                  top: it.y - 2,
                  width: it.w + 4,
                  height: it.h + 4,
                  transform: `rotate(${it.rot}deg)`,
                  border: `${sc(2)} solid ${style.borderColor}`,
                  borderRadius: sc(8),
                  boxShadow: style.emphasize ? `0 0 ${sc(14)} ${style.borderColor}` : undefined,
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  zIndex: 1_500_000,
                }}
              />
            )}
            <div
              data-tag-chips={it.id}
              style={{
                position: 'absolute',
                left: it.x,
                top: `calc(${it.y}px - ${sc(22)})`,
                display: 'flex',
                gap: sc(3),
                transform: `rotate(${it.rot}deg)`,
                transformOrigin: '0 100%',
                pointerEvents: 'none',
                zIndex: 1_500_001,
              }}
            >
              {it.tags.map((t) => (
                <span
                  key={t.id}
                  data-tag-chip={t.id}
                  style={{
                    background: t.color,
                    color: '#fff',
                    fontSize: sc(11),
                    lineHeight: sc(16),
                    padding: `0 ${sc(6)}`,
                    borderRadius: sc(8),
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                  }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
