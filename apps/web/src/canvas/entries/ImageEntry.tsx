import { type Ref, useState } from 'react'
import { assetUrl } from '../../api/assets'
import { useT } from '../../i18n'
import type { EntryMeta } from '../state/entry-store'

/** Image entry: renders the processed asset (capped webp). Variant-by-on-screen-size is a later
 *  perf optimization; Phase 2 serves the `full` variant. */
export function ImageEntry({ meta, innerRef }: { meta: EntryMeta; innerRef: Ref<HTMLDivElement> }) {
  // Track which asset id failed to load, so the placeholder is shown only for that asset and
  // resets automatically when the entry points at a different (or newly re-uploaded) image.
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null)
  const imageFailed = meta.imageAssetId != null && failedAssetId === meta.imageAssetId
  const t = useT()

  return (
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry entry-image"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        overflow: 'hidden',
        background: '#eee',
      }}
    >
      {meta.imageAssetId && !imageFailed ? (
        <img
          src={assetUrl(meta.imageAssetId)}
          alt=""
          draggable={false}
          onError={() => setFailedAssetId(meta.imageAssetId ?? null)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : imageFailed ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-2, 8px)',
            fontSize: 'var(--text-sm, 13px)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          🖼️ {t('canvas.imageUnavailable')}
        </div>
      ) : (
        <div style={{ padding: 8, fontSize: 12, color: '#888' }}>{t('canvas.image')}</div>
      )}
    </div>
  )
}
