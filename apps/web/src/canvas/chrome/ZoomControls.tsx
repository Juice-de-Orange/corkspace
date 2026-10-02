import { ZOOM } from '@corkspace/shared'
import { useMemo } from 'react'
import { computed } from 'signia'
import { useValue } from 'signia-react'
import { useT } from '../../i18n'
import { applyZoomAround, cameraAtom, viewportAtom } from '../state/camera-store'

const clampZoom = (z: number): number => Math.min(ZOOM.max, Math.max(ZOOM.min, z))

/** Frosted zoom cluster (bottom-left, above the position readout). Zooms about the viewport
 *  centre. The percent label re-renders only when the rounded zoom changes (not on pan). */
export function ZoomControls() {
  const t = useT()
  const zoomPct = useValue(
    useMemo(() => computed('zoom-pct', () => Math.round(cameraAtom.value.zoom * 100)), []),
  )

  const zoomBy = (factor: number): void => {
    const vp = viewportAtom.value
    applyZoomAround(vp.w / 2, vp.h / 2, clampZoom(cameraAtom.value.zoom * factor))
  }

  return (
    <div
      className="zoom-controls toolbar"
      data-export-ignore
      data-ui-chrome
      style={{ position: 'absolute', left: 8, bottom: 44 }}
    >
      <button
        type="button"
        aria-label={t('boards.zoomOut')}
        title={t('boards.zoomOut')}
        onClick={() => zoomBy(1 / 1.2)}
        className="btn btn-ghost btn-icon"
      >
        −
      </button>
      <span
        className="zoom-pct"
        style={{
          minWidth: 46,
          textAlign: 'center',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--panel-text)',
        }}
      >
        {zoomPct}%
      </span>
      <button
        type="button"
        aria-label={t('boards.zoomIn')}
        title={t('boards.zoomIn')}
        onClick={() => zoomBy(1.2)}
        className="btn btn-ghost btn-icon"
      >
        +
      </button>
    </div>
  )
}
