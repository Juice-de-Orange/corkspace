import { memo, type Ref, useCallback, useMemo } from 'react'
import { computed } from 'signia'
import { useValue } from 'signia-react'
import { bumpRender } from '../devtools/render-count'
import { lodMapAtom, registerEntryEl } from '../runtime/canvas-runtime'
import type { EntryMeta } from '../state/entry-store'
import { ChecklistEntry } from './ChecklistEntry'
import { DocEntry } from './DocEntry'
import { ImageEntry } from './ImageEntry'
import { LinkCard } from './LinkCard'
import { StickyEntry } from './StickyEntry'

/** Lowest LOD: a solid coloured block (no content mounted) for entries that are tiny on screen. */
function BlockEntry({ meta, innerRef }: { meta: EntryMeta; innerRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry entry-block"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        background: meta.color ?? '#cfc9bd',
      }}
    />
  )
}

/** Placeholder block for entry types not yet built (doc/checklist/image/link content lands
 *  incrementally in Phase 2). */
function PlaceholderEntry({ meta, innerRef }: { meta: EntryMeta; innerRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        padding: 8,
        boxSizing: 'border-box',
        fontSize: 14,
        overflow: 'hidden',
      }}
    >
      {meta.type}
    </div>
  )
}

/**
 * A world-positioned entry. It never subscribes to the camera signal, so camera moves do not
 * re-render it (the world container's transform handles pan/zoom). Registers its DOM element
 * for the culling layer's imperative display:none toggling.
 */
export const EntryView = memo(function EntryView({ meta }: { meta: EntryMeta }) {
  bumpRender(meta.id)
  // Callback ref: React invokes it with the node on mount and null on unmount — INCLUDING across an
  // LOD block↔full swap, where the rendered element TYPE changes but meta.id does not. A stale
  // [meta.id] effect would miss that swap and leave the culling registry pointing at a detached
  // node (off-screen entries stuck visible); the callback ref always re-registers the live node.
  const registerRef = useCallback(
    (el: HTMLDivElement | null) => registerEntryEl(meta.id, el),
    [meta.id],
  )
  // Per-entry LOD: re-renders only when THIS entry's bucket changes (not on every camera move).
  const lod = useValue(
    useMemo(
      () => computed(`lod:${meta.id}`, () => lodMapAtom.value.get(meta.id) ?? 'full'),
      [meta.id],
    ),
  )

  if (lod === 'block') {
    return <BlockEntry meta={meta} innerRef={registerRef} />
  }

  if (meta.type === 'sticky') {
    return <StickyEntry meta={meta} innerRef={registerRef} />
  }
  if (meta.type === 'image') {
    return <ImageEntry meta={meta} innerRef={registerRef} />
  }
  if (meta.type === 'checklist') {
    return <ChecklistEntry meta={meta} innerRef={registerRef} />
  }
  if (meta.type === 'link') {
    return <LinkCard meta={meta} innerRef={registerRef} />
  }
  if (meta.type === 'doc') {
    return <DocEntry meta={meta} innerRef={registerRef} />
  }
  return <PlaceholderEntry meta={meta} innerRef={registerRef} />
})
